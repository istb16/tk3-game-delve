/**
 * CSS の副作用インポートを型に認識させる。
 * tsconfig の "types": [] で環境型を絞っているため、必要な宣言だけをここに置く。
 */
declare module '*.css';

/**
 * アプリのバージョン。vite.config.ts の `define` が package.json の値に置き換える。
 * ソースに直書きしないための唯一の入口。
 */
declare const __APP_VERSION__: string;
