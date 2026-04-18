# PJ02 ビジョン補足: 研究パイプラインと M3E の価値源泉

## 研究活動のサイクル
F → R → D → R → D... の反復。一方通行ではない。

## パイプライン全体像
```
3GB PDF群 → 分類 → 読込 → markdown化   [既存ツール導入で対応、未着手]
                                  ↓
          md files → syntax tree (Rapid)  [★M3E の価値が生まれる境界]
                                  ↓
          syntax tree ⇄ semantic tree (Deep)  [PJ02 edge protocol のコア]
```

## 判断
- PDF→md は既存ツール導入タスク（別途やる必要あり、PJ02 の前提）
- **M3E の本質的価値**: md群 → syntax tree 表示 (Rapid) → semantics tree (Deep)
- この変換こそが PJ02 で取り組むべき本丸
- Blueprint importer も md importer も同系統の「→ Rapid」変換器

*2026-04-17*
