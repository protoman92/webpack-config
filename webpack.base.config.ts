import * as DotEnv from 'dotenv-webpack';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import { Objects } from 'javascriptutilities';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import * as UglifyJS from 'uglifyjs-webpack-plugin';
import * as webpack from 'webpack';
import { Configuration as Config } from 'webpack';
type Env = 'dev' | 'prod';
type ExtraConfig = Pick<Config, 'entry'> & {
  /**
   * Specify root-level folder paths that will be added to alias resolution.
   * For e.g., ['component', 'dependency'] will be converted to src/component
   * and src/dependency.
   */
  readonly rootLevelAliasPaths: string[];
  readonly publicFolder?: string;
  readonly assetFolder?: string;
};

function srcPath(subdir: string): string {
  return path.join(__dirname, 'src', subdir);
}

export default function buildConfig(env: Env, extraConfigs: ExtraConfig): Config {
  let publicFolder = extraConfigs.publicFolder || 'public';
  let assetFolder = extraConfigs.assetFolder || 'assets';

  return {
    ...Objects.deleteKeys(extraConfigs,
      'assetFolder',
      'publicFolder',
      'rootLevelAliasPaths',
    ),
    output: {
      path: path.join(__dirname, `${publicFolder}`),
      filename: '[name].bundle.js',
      chunkFilename: '[name].bundle.js',
      publicPath: (() => env === 'prod' ? `/${publicFolder}/` : undefined)(),
    },
    optimization: {
      runtimeChunk: 'single',
      splitChunks: {
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            enforce: true,
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
            ? [{
              enforce: 'pre',
              test: /\.js$/,
              loader: 'source-map-loader',
              exclude: [/node_modules/],
            }]
            : [];
        })(),
        { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
        { test: /\.html$/, exclude: /node_modules/, loader: 'html-loader' },
        { test: /\.json$/, loader: 'json-loader' },
        {
          test: /\.s?css?$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
        },
        {
          test: /.*\.(gif|png|jpe?g)$/i,
          use: [
            {
              loader: 'url-loader',
              options: {
                name: path.join(
                  '/',
                  publicFolder,
                  assetFolder,
                  'images',
                  '[name]_[hash:7].[ext]',
                ),
              },
            },
          ],
        },
      ],
    },
    resolve: {
      alias: extraConfigs.rootLevelAliasPaths
        .map(v => ({ [v]: srcPath(v) }))
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
      ...(() => (env === 'dev') ? [new DotEnv()] : [])(),
      ...(() => (env === 'prod') ? [new UglifyJS()] : [])(),
      new MiniCssExtractPlugin({
        filename: '[name].[hash].css',
        chunkFilename: '[id].[hash].css'
      }),
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        inject: 'body',
      }),
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(JSON.parse(process.env.DEBUG || 'false'))
      }),
    ],
  };
}