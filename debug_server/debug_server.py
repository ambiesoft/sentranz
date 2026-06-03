import argparse
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import json
import time

app = FastAPI()

request_count = 0

args = None

DEFAULT_JSON = '''
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": ""
      }
    }
  ]
}
'''
LONGMD='''
## mdview
MD(markdown)ファイルを表示するアプリケーションです。

## 動作環境
.NET 4.0

## 取扱種別
このソフトはフリーウェアです。LICENCEファイルを参照してください。

## インストール
ダウンロードしたファイルは7z形式の自己解凍ファイルです。実行して解凍するか7zなどの解凍ソフトウェアで解凍してください。
インストーラーはありません。

## アンインストール
ファイルを削除してください。アンインストーラーはありません。

## 使い方
mdview.exeを起動しファイルを開くボタンから希望のmdを選択します。

## ファイルの変更を監視
*ファイルの監視* ボタンをクリックすることにより監視が有効になります。ファイルの変更がブラウザ上のページに反映されます。

## ダウンロード
バイナリーはここから入手できます。
<https://github.com/ambiesoft/mdview/releases>

## 寄付
開発の寄付を募集しています。
<https://ambiesoft.github.io/webjumper/?target=donate>

## 作者への連絡先
* 電子メール <ambiesoft.trueff@gmail.com>
* 掲示板 <https://ambiesoft.github.io/webjumper/?target=bbs>
* 開発 <https://github.com/ambiesoft/mdview>
'''


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[Message]


def is_sentence_request(text: str) -> bool:
    return not is_ask_request(text)


def is_ask_request(text: str) -> bool:
    return "You are an English reading tutor." in text


@app.post("/v1/chat/completions")
async def chat(req: ChatRequest):
    time.sleep(1)

    global request_count
    request_count += 1

    content = req.messages[-1].content

    sentence_mode = is_sentence_request(content)
    ask_mode = is_ask_request(content)

    print(f"REQUEST #{request_count}")

    #
    # sentence request error
    #

    if (
        sentence_mode
        and args.Sre
        and request_count == args.Sre
    ):
        raise HTTPException(
            status_code=500,
            detail="Simulated sentence request failure"
        )

    #
    # ask request error
    #

    if (
        ask_mode
        and args.Are
        and request_count == args.Are
    ):
        raise HTTPException(
            status_code=500,
            detail="Simulated ask_ai failure"
        )

    #
    # normal sentence
    #
    if sentence_mode:
        ret = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": LONGMD,
                    }
                }
            ]
        }

        return ret
    #
    # normal ask
    #

    if ask_mode:

        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content":LONGMD,

                    }
                }
            ]
        }

    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "unknown request"
                }
            }
        ]
    }


if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument("-Sre", type=int)
    parser.add_argument("-Snj", type=int)
    parser.add_argument("-Sfj", type=int)
    parser.add_argument("-Are", type=int)

    args = parser.parse_args()

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=1234
    )
