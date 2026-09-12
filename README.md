# MathLoop

> 解く。

学部数学の演習問題を解き、結果と学習統計を記録する個人向けWebアプリです。

Codexでエンター押していたらできました。ありがとう。2

## コンテスト構成

レベル1〜3のシリーズ構成です。現在は`レベル 1 #001`から`レベル 1 #010`までの10セット、全50問を収録しています。一覧では1セットを1行、A〜Eの問題を列として表示します。

## 主な機能

- 問題タイトル・分野・知識タグによる検索と絞り込み
- 日本語・TeXによる回答とライブプレビュー
- 解答写真の添付
- AC・要確認・WAの採点結果表示
- 解説、定義、定理、周辺知識の確認
- Supabaseを使ったスマホ・PC間の学習記録同期
- 分野別・タグ別・難易度別の統計

## 25マス計算

メニューの「25マス計算」から、縦横それぞれ5つの対象を組み合わせる計算表に取り組めます。5分野・14種類、全240セット（6,000マス）を収録しています。

- 計算：整数加算・乗算、分数加算、複素数乗算（各10セット）
- 代数：ベクトルの内積、行列積
- 解析：多項式の微分
- 構造：最大公約数、剰余
- 幾何：1形式の評価、wedge積、df、外微分、pullback

追加10種類は基礎・標準を各10セット収録。同じセット番号では同じ問題を出題します。練習では1マスずつ確認し、係数入力・数式プレビュー・解説・誤答復習を利用できます。計測では開始後に問題を表示し、提出後に正誤を表示します。多項式は専用パーサーで同値性を厳密に採点します。

初回回答と最終回答を別々に記録し、中断・支援のない全問正解タイムを比較します。履歴はこのブラウザに保存し、専用JSONの書き出し・読み込みに対応。旧25マス計算の記録も移行します。通常問題の統計・端末間同期とは独立しています。詳しい仕様と今後の拡張は [全体設計](docs/25-grid-design.md) を参照してください。

## ローカル起動

Node.js 22.13以降を使用します。

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run build:pages
```

GitHub Pages用の成果物は `dist/client/math-loop` に作成されます。

## GitHub Pages への公開

このサイトへの変更は、ローカルで完結させず GitHub Pages にも反映します。
`main` ブランチへ push すると、[GitHub Actions](.github/workflows/pages.yml) が `npm run build:pages` を実行し、生成物を GitHub Pages へ自動デプロイします。

公開する変更では、`main` へマージ・push した後に Actions の **Deploy MathLoop to GitHub Pages** が成功していることを確認してください。作業ブランチへの push だけでは公開されません。

## Supabase

`.env.example` を `.env.local` にコピーし、SupabaseのURLとPublishable Keyを設定します。

```bash
npx supabase db push
npx supabase secrets set SAKURA_AI_API_KEY=your_key
npx supabase functions deploy grade-answer
```

`grade-answer` はログインユーザーだけが利用でき、AI採点は1時間10回・1日40回までです。
