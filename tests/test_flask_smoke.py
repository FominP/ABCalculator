import pytest

from app import app


CALCULATION_CASES = [
    pytest.param(
        {
            "test_type": "z_proportions",
            "params": {
                "conv_control": 40,
                "n_control": 500,
                "conv_test": 50,
                "n_test": 500,
            },
        },
        "p_value",
        id="two-proportion-z-test",
    ),
    pytest.param(
        {
            "test_type": "t_means",
            "params": {
                "mean_control": 10.0,
                "std_control": 2.0,
                "n_control": 100,
                "mean_test": 10.8,
                "std_test": 2.2,
                "n_test": 110,
            },
        },
        "p_value",
        id="welch-t-test",
    ),
    pytest.param(
        {
            "test_type": "chi_square",
            "params": {
                "conv_control": 40,
                "nonconv_control": 460,
                "conv_test": 50,
                "nonconv_test": 450,
            },
        },
        "p_value",
        id="chi-square-test",
    ),
    pytest.param(
        {
            "test_type": "srm",
            "params": {
                "n_control": 500,
                "n_test": 500,
                "expected_ratio": 0.5,
            },
        },
        "observed_ratio",
        id="sample-ratio-mismatch",
    ),
    pytest.param(
        {
            "test_type": "mde",
            "params": {
                "baseline_conversion": 0.1,
                "n_control": 5000,
                "n_test": 5000,
                "alpha": 0.05,
                "power": 0.8,
            },
        },
        "mde_absolute",
        id="minimum-detectable-effect",
    ),
]


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    with app.test_client() as test_client:
        yield test_client


def test_home_page_is_available(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.content_type.startswith("text/html")
    assert "Калькулятор A/B-тестов" in response.get_data(as_text=True)


def test_health_check_is_available(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


@pytest.mark.parametrize("payload, expected_result_key", CALCULATION_CASES)
def test_valid_calculation_examples(client, payload, expected_result_key):
    response = client.post("/calculate", json=payload)

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert isinstance(body["result"], dict)
    assert expected_result_key in body["result"]
