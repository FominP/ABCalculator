# Repository working agreements

These instructions apply to the whole repository. Keep changes small and tied to the issue being implemented.

## Project invariants

- This is a Python/Flask web app, not a static-only calculator. The Flask app and routes are in `app.py`; the page is `templates/index.html`, with browser behavior in `static/script.js` and styles in `static/style.css`.
- All statistical calculations run on the server. The browser sends JSON (`test_type` and `params`) to `POST /calculate`; `app.py` validates inputs and delegates the statistical methods to `ab_test_analyzer`. Do not silently move calculations into JavaScript or change statistical behavior.
- Supported analyses are two-proportion Z, Welch T, chi-square, SRM, and MDE. Preserve server-side validation and the documented JSON success/error contract when modifying them.
- `GET /` serves the UI; `GET /healthz` is the Render health check. Never log experiment input payloads or add secrets to the repository.
- Production is **https://abcalculator.onrender.com**, deployed as a Flask/Gunicorn service on Render, **not GitHub Pages**. `render.yaml` configures Python 3.12.8, `pip install -r requirements.txt`, `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120`, `/healthz`, and automatic deploys on commits to the configured branch. A free-tier cold start can delay requests.

## Local commands

Follow [README.md](README.md) for platform-specific setup. Prefer Python 3.12 to match Render:

```bash
python -m venv venv
# On Linux/macOS:
source venv/bin/activate
# On Windows PowerShell: .\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Visit `http://127.0.0.1:5000/`. Browser smoke tests live in `tests/e2e` and
start Flask automatically on a free local port. Install and run them with:

```bash
python -m pip install -r requirements.txt -r requirements-dev.txt
python -m playwright install chromium
python -m pytest tests/e2e
```

For a faster targeted Flask check when browser coverage is not relevant, use:

```bash
python - <<'PY'
from app import app

with app.test_client() as client:
    assert client.get("/").status_code == 200
    assert client.get("/healthz").json == {"status": "ok"}
    response = client.post("/calculate", json={
        "test_type": "z_proportions",
        "params": {
            "conv_control": 40, "n_control": 500,
            "conv_test": 50, "n_test": 500,
        },
    })
    assert response.status_code == 200 and response.json["success"], response.json

print("Flask smoke checks passed")
PY
```

Use `python -m compileall -q app.py` for a Python syntax check. For GitHub template changes, validate the YAML and inspect the rendered GitHub forms after they reach the default branch. Record which checks actually ran and which could not run.

## Scope and completion

1. Work from one issue on one dedicated branch and submit one focused PR; see [CONTRIBUTING.md](CONTRIBUTING.md).
2. Meet the issue's acceptance criteria without unrelated refactors, statistical-method changes, dependency upgrades, or hosting changes. Raise follow-up issues for unrelated findings.
3. Preserve the server-side request/response contract and Render deployment unless a task expressly changes them.
4. Before declaring work done, review the diff, run applicable checks, document manual testing and limitations, and update documentation when behavior or workflows change.
5. Include a linked issue, concise change summary, test evidence, UI screenshots when applicable, risks, deployment impact, and rollback notes in the PR. Do not claim unrun checks passed or merge without review.
