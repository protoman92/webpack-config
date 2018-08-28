import * as DotEnv from 'dotenv-webpack';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import {JSObject, Objects} from 'javascriptutilities';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import * as UglifyJS from 'uglifyjs-webpack-plugin';
import * as webpack from 'webpack';
import {
  Configuration as Config,
  HotModuleReplacementPlugin,
  Loader,
} from 'webpack';
export type Env = 'dev' | 'prod';
type ExtraConfig = Pick<Config, 'entry'> & {
  /**
   * Specify root-level folder paths that will be added to alias resolution.
   * For e.g., 'component', 'dependency' will be converted to src/component
   * and src/dependency.
   */
  readonly rootLevelAliasPaths: JSObject<string>;
  readonly dirName: string;
  readonly entryPathFn: (env: Env, dirName: string) => string;
  readonly publicPath?: string;
};

function srcPath(dirName: string, subdir: string): string {
  return path.join(dirName, 'src', subdir);
}

export default function buildConfig(
  env: Env,
  extraConfigs: ExtraConfig
): Config {
  let distFolder = 'dist_webpack';
  let assetFolder = 'asset';

  return {
    ...Objects.deleteKeys(
      extraConfigs,
      'dirName',
      'entryPathFn',
      'publicPath',
      'rootLevelAliasPaths'
    ),
    entry: [
      ...((): string[] => {
        if (env === 'dev') {
          return ['webpack-hot-middleware/client'];
        } else {
          return [];
        }
      })(),
      extraConfigs.entryPathFn(env, extraConfigs.dirName),
    ],
    output: {
      path: path.join(extraConfigs.dirName, distFolder),
      filename: '[name].bundle.js',
      chunkFilename: '[name].bundle.js',
      publicPath: extraConfigs.publicPath,
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all',
          },
        },
      },
    },
    devtool: env === 'prod' ? undefined : 'source-map',
    module: {
      rules: [
        ...((): webpack.RuleSetRule[] => {
          return env === 'dev'
            ? [
                {
                  enforce: 'pre',
                  test: /\.js$/,
                  loader: 'source-map-loader',
                  exclude: [/node_modules/],
                },
              ]
            : [];
        })(),
        {test: /\.tsx?$/, loader: 'awesome-typescript-loader'},
        {test: /\.html$/, exclude: /node_modules/, loader: 'html-loader'},
        {test: /\.json$/, loader: 'json-loader'},
        {
          test: /\.s?css?$/,
          use: [
            ((): Loader => {
              if (env === 'prod') {
                return MiniCssExtractPlugin.loader;
              } else {
                return 'style-loader';
              }
            })(),
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /.*\.(gif|png|jpe?g)$/i,
          use: [
            {
              loader: 'url-loader',
              options: {
                name: path.join(
                  '/',
                  distFolder,
                  assetFolder,
                  'images',
                  '[name]_[hash:7].[ext]'
                ),
              },
            },
          ],
        },
      ],
    },
    resolve: {
      alias: Objects.entries(extraConfigs.rootLevelAliasPaths)
        .filter(([_key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => ({[key]: srcPath(extraConfigs.dirName, value!)}))
        .reduce((acc, v) => Object.assign(acc, v), {}),
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    mode: env === 'prod' ? 'production' : 'development',
    node: {
      console: env === 'prod' ? false : undefined,
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
    },
    plugins: [
      ...(() => (env === 'dev' ? [new DotEnv()] : []))(),
      ...(() => (env === 'prod' ? [new UglifyJS()] : []))(),
      ...(() => (env === 'dev' ? [new HotModuleReplacementPlugin()] : []))(),
      new MiniCssExtractPlugin({
        filename: '[name].[hash].css',
        chunkFilename: '[id].[hash].css',
      }),
      new HtmlWebpackPlugin({
        template: `${extraConfigs.dirName}/src/index.html`,
        filename: 'index.html',
        inject: 'body',
      }),
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(JSON.parse(process.env.DEBUG || 'false')),
      }),
    ],
  };
}
