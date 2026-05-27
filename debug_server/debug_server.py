import argparse
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import json

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


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[Message]


def is_sentence_request(text: str) -> bool:
    return "Translate the sentence" in text


def is_ask_request(text: str) -> bool:
    return "User question:" in text


@app.post("/v1/chat/completions")
async def chat(req: ChatRequest):

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
    # invalid json
    #

    if (
        sentence_mode
        and args.Snj
        and request_count == args.Snj
    ):

        json_obj = json.loads(DEFAULT_JSON)
        json_obj["choices"][0]["message"]["content"] = "DEBUG SEVER SEND THIS :THIS IS NOT JSON"

        print(json.dumps(json_obj, indent=2))
        return json_obj
    #
    # missing field json
    #

    if (
        sentence_mode
        and args.Sfj
        and request_count == args.Sfj
    ):

        bad_json = {
            "translation": "翻訳だけ",
            "summary_ja": "要約だけ"
        }

        return {
            "choices": [
                {
                    "message": {
                        "content":
                            json.dumps(bad_json)
                    }
                }
            ]
        }

    #
    # normal sentence
    #

    if sentence_mode:
        good_json = {
            "translation": "翻訳だけ",
            "summary_ja": "要約だけ",
            "summary_en": "summary only",
            "grammar_explanation": "grammar explanation only"
        }

        ret = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content":
                            json.dumps(good_json)
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
                        "content":
                            "これは Ask AI の返答です"
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
