#!/usr/bin/env bash
# 一键重建所有生成文件：底图、网页数据、3D 模型。改了 park_source.json 之后运行它。
set -e
cd "$(dirname "$0")"
python3 build_plan.py
python3 build_data.py
python3 build_models.py
