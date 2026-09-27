# Thought Space (思考共有空間)

K / H / A の3人だけで使う、完全クローズドな思考共有Webアプリ。
SNSやチャットのようなタイムラインではなく、過去の思考も消えずに漂い続ける「3D空間」です。

## 技術スタック
- React / TypeScript
- Vite
- React Three Fiber / Three.js
- Zustand
- Supabase (永続化)

## コンセプト
- K/H/Aの3人専用（ログイン不要で選択するだけ）
- 思考のノートは物理法則に従って無重力/水中のようにゆっくりと漂う
- 古いノートも空間に残り続ける
- 関連する思考をつなげることができる
- ドラッグして投げると慣性で漂い続ける
- 新しいノートは明るく、時間が経つと暗く落ち着く

## ローカルでの起動方法

1. リポジトリをクローンまたはダウンロード
2. パッケージのインストール
   ```bash
   npm install
   ```
3. 環境変数の設定
   `.env.example` をコピーして `.env.local` を作成し、SupabaseのURLとKeyを設定してください。
   ```bash
   cp .env.example .env.local
   ```
4. 開発サーバーの起動
   ```bash
   npm run dev
   ```

## Supabaseのセットアップ

1. [Supabase](https://supabase.com) で新しいプロジェクトを作成
2. SQLエディタで `supabase/schema.sql` を実行してテーブルとRSLポリシーを作成
3. Project Settings > API から `URL` と `anon public` key を取得し、`.env.local` に設定

※ Supabaseの設定がない場合でも、一時的なモックデータとして動作しますが、リロードするとリセットされます。

## デプロイ

Vercel, Netlify, または Cloudflare Pages へのデプロイを推奨します。
環境変数として `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定してください。
