import logging

import app as app_module


def test_calculate_does_not_log_request_or_result(monkeypatch, caplog, capsys):
    request_marker = "private-experiment-input-6f3e2b"
    result_marker = "private-calculation-result-91a7c4"

    monkeypatch.setattr(
        app_module,
        "process_test",
        lambda test_type, params: {"marker": result_marker},
    )

    with caplog.at_level(logging.DEBUG):
        response = app_module.app.test_client().post(
            "/calculate",
            json={
                "test_type": "privacy_regression",
                "params": {"marker": request_marker},
            },
        )

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "result": {"marker": result_marker},
    }

    def raise_private_error(test_type, params):
        raise RuntimeError(result_marker)

    monkeypatch.setattr(app_module, "process_test", raise_private_error)
    with caplog.at_level(logging.DEBUG):
        error_response = app_module.app.test_client().post(
            "/calculate",
            json={
                "test_type": "privacy_regression",
                "params": {"marker": request_marker},
            },
        )

    assert error_response.status_code == 500

    captured = capsys.readouterr()
    emitted_text = "\n".join(
        [
            captured.out,
            captured.err,
            *(record.getMessage() for record in caplog.records),
        ]
    )

    assert request_marker not in emitted_text
    assert result_marker not in emitted_text
