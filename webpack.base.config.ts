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

export type Env = 'dev' | 'staging' | 'prod';

type ExtraConfig = Pick<Config, 'entry'> &
  Readonly<{
    /**
     * Specify root-level folder paths that will be added to alias resolution.
     * For e.g., 'component', 'dependency' will be converted to src/component
     * and src/dependency.
     */
    rootLevelAliasPaths: JSObject<string>;
    dirName: string;
    publicPath?: string;
    envFilePath?: string;
    getEntryPaths: (dirName: string) => string | string[];
  }>;

function relativePath(dirName: string, subdir: string): string {
  return path.join(dirName, subdir);
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
      'envFilePath',
      'getEntryPaths',
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
      ...(() => {
        let extraPaths = extraConfigs.getEntryPaths(extraConfigs.dirName);

        if (extraPaths instanceof Array) {
          return extraPaths;
        } else {
          return [extraPaths];
        }
      })(),
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
    devtool: env === 'dev' ? 'source-map' : undefined,
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
              if (env === 'dev') {
                return 'style-loader';
              } else {
                return MiniCssExtractPlugin.loader;
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
        .map(([key, value]) => ({
          [key]: relativePath(extraConfigs.dirName, value!),
        }))
        .reduce((acc, v) => Object.assign(acc, v), {}),
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    mode: env === 'dev' ? 'development' : 'production',
    node: {
      console: env === 'dev' ? undefined : false,
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
    },
    plugins: [
      new DotEnv({path: extraConfigs.envFilePath}),
      ...(() => (env === 'dev' ? [] : [new UglifyJS()]))(),
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
