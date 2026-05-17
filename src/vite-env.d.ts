/// <reference types="vite/client" />
// *.css は import 可能モジュール
// import "./styles.css";はJS moduleではない。Vite bundler が：CSS抽出style injectionしている。

declare module "*.css";