# 問題: 表現状態が map state に混ざっている

## 背景

現在の M3E API は、node の本文・親子構造・リンクなどの semantic state と、viewer 上の見え方に近い状態が同じ保存単位に混ざっている。

典型例は `TreeNode.collapsed`。

これはユーザーが画面上で作った「今の見え方」だが、map 全体を `GET -> mutate -> POST` する agent 作業では、本文変更や構造変更のついでに上書きされる。

## 起きた事故

Miro UI の Progressive Navigation を map に書き込む作業で、agent が以下を行った。

1. map 全体を GET
2. UI 再現ノードを追加・置換
3. doc 全体を POST

その結果、ユーザーが viewer 上で作っていた expand/collapse 状態が、agent 側の保存時点の `collapsed` 値で上書きされた。

本文だけを直すつもりの操作でも、full-state POST では view state が巻き添えになる。

## 問題の本質

AI/agent が主に触るべき状態:

- node text
- parent / children
- links
- attributes
- notes
- schema / semantic metadata

人間の操作で守るべき状態:

- expanded / collapsed
- selected node
- current scope
- viewport x / y / zoom
- surface mode
- panel open / closed
- filter / sort
- active tool
- annotation visibility

この2つは更新頻度も所有者も違う。
同じ doc envelope に置くと、agent の構造編集が人間の作業中視界を壊す。

## 目標

map の意味構造を安全に更新しながら、viewer の表現状態はユーザー単位・セッション単位で保護する。
