use pragmatic_segmenter::Segmenter;

fn normalize_paragraph(text: &str) -> String {
    text.replace("\r\n", "\n")
        // 単改行をspaceへ
        .replace('\n', " ")
        // 多重空白整理
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn split_sentences(text: &str) -> Vec<String> {
    let segmenter = Segmenter::new().unwrap();

    let paragraphs = text.split("\n\n");

    let mut results = Vec::new();

    for para in paragraphs {
        let normalized = normalize_paragraph(para);

        if normalized.is_empty() {
            continue;
        }

        for s in segmenter.segment(&normalized) {
            let s = s.trim();

            if !s.is_empty() {
                results.push(s.to_string());
            }
        }
    }

    results
}
