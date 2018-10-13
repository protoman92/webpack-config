import * as DotEnv from 'dotenv-webpack';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import { JSObject, Objects } from 'javascriptutilities';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import * as UglifyJS from 'uglifyjs-webpack-plugin';
import {
  Configuration as Config,
  DefinePlugin,
  HotModuleReplacementPlugin,
  Loader,
  RuleSetRule
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
    rootUrl?: string;
    envVarsFilePath?: string;
    getEntryPaths: (dirName: string) => string | string[];
  }>;

function relativePath(dirName: string, subdir: string): string {
  return path.join(dirName, subdir);
}

export default function buildConfig(
  env: Env,
  extraConfigs: ExtraConfig
): Config {
  const { publicPath = '/', rootUrl = 'localhost:3000' } = extraConfigs;

  const distFolder = 'dist_webpack';
  const assetFolder = 'asset';

  return {
    ...Objects.deleteKeys(
      extraConfigs,
      'dirName',
      'envVarsFilePath',
      'getEntryPaths',
      'publicPath',
      'rootUrl',
      'rootLevelAliasPaths'
    ),
    entry: [
      ...((): string[] => {
        if (env === 'dev') {
          return [
            `webpack-hot-middleware/client?path=${publicPath}/${rootUrl}/__webpack_hmr&timeout=20000&reload=true`
          ];
        }

        return [];
      })(),
      ...(() => {
        const extraPaths = extraConfigs.getEntryPaths(extraConfigs.dirName);

        if (extraPaths instanceof Array) {
          return extraPaths;
        }

        return [extraPaths];
      })()
    ],
    output: {
      publicPath,
      path: path.join(extraConfigs.dirName, distFolder),
      filename: '[name].bundle.js',
      chunkFilename: '[name].bundle.js'
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all'
          }
        }
      }
    },
    devtool: env === 'dev' ? 'source-map' : undefined,
    module: {
      rules: [
        ...((): RuleSetRule[] => {
          return env === 'dev'
            ? [
                {
                  enforce: 'pre',
                  test: /\.js$/,
                  loader: 'source-map-loader',
                  exclude: [/node_modules/]
                }
              ]
            : [];
        })(),
        { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
        { test: /\.html$/, exclude: /node_modules/, loader: 'html-loader' },
        { test: /\.json$/, loader: 'json-loader' },
        {
          test: /\.s?css?$/,
          use: [
            ((): Loader => {
              if (env === 'dev') {
                return 'style-loader';
              }

              return MiniCssExtractPlugin.loader;
            })(),
            'css-loader',
            'sass-loader'
          ]
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
                )
              }
            }
          ]
        }
      ]
    },
    resolve: {
      alias: Objects.entries(extraConfigs.rootLevelAliasPaths)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => ({
          [key]: relativePath(extraConfigs.dirName, value!)
        }))
        .reduce((acc, v) => Object.assign(acc, v), {}),
      extensions: ['.ts', '.tsx', '.js', '.json']
    },
    mode: env === 'dev' ? 'development' : 'production',
    node: {
      console: env === 'dev' ? undefined : false,
      fs: 'empty',
      net: 'empty',
      tls: 'empty'
    },
    plugins: [
      new DotEnv({ path: extraConfigs.envVarsFilePath }),
      ...(() => (env === 'dev' ? [] : [new UglifyJS()]))(),
      ...(() => (env === 'dev' ? [new HotModuleReplacementPlugin()] : []))(),
      new MiniCssExtractPlugin({
        filename: '[name].[hash].css',
        chunkFilename: '[id].[hash].css'
      }),
      new HtmlWebpackPlugin({
        template: `${extraConfigs.dirName}/src/index.html`,
        filename: 'index.html',
        inject: 'body'
      }),
      new DefinePlugin({
        __DEV__: JSON.stringify(JSON.parse(process.env.DEBUG || 'false'))
      })
    ]
  };
}
