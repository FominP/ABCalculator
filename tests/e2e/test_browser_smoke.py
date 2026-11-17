import pytest
from playwright.sync_api import expect


ANALYSIS_FIELDS = {
    "z_proportions": ["conv_control", "n_control", "conv_test", "n_test"],
    "t_means": [
        "mean_control",
        "std_control",
        "n_control",
        "mean_test",
        "std_test",
        "n_test",
    ],
    "chi_square": [
        "conv_control",
        "nonconv_control",
        "conv_test",
        "nonconv_test",
    ],
    "srm": ["n_control", "n_test", "expected_ratio"],
    "mde": ["baseline_conversion", "n_control", "n_test", "alpha", "power"],
}


def open_calculator(page, base_url):
    page.goto(base_url, wait_until="domcontentloaded")
    expect(page.locator("#dynamicFields input").first).to_be_visible()


def test_home_page_shows_main_calculator_controls(page, base_url):
    open_calculator(page, base_url)

    expect(page.locator("h1")).to_contain_text("Калькулятор A/B-тестов")
    expect(page.locator("#testType")).to_be_visible()
    expect(page.locator("#calculateBtn")).to_be_visible()
    expect(page.locator("#exampleBtn")).to_be_visible()
    expect(page.locator("#resetBtn")).to_be_visible()


def test_two_proportion_example_posts_and_renders_result(page, base_url):
    open_calculator(page, base_url)
    page.locator("#exampleBtn").click()

    with page.expect_response(
        lambda response: response.url.endswith("/calculate") and response.request.method == "POST"
    ) as response_info:
        page.locator("#calculateBtn").click()

    response = response_info.value
    assert response.status == 200
    assert response.json()["success"] is True
    expect(page.locator("#resultCard")).to_be_visible()
    expect(page.locator("#resultBody")).to_contain_text("P-значение")
    expect(page.locator("#resultBody")).to_contain_text("Разница статистически значима")
    expect(page.locator("#chartContainer")).to_be_visible()
    expect(page.locator("#resultChart")).to_be_visible()
    page.wait_for_function(
        """() => {
            const canvas = document.querySelector('#resultChart');
            const pixels = canvas.getContext('2d').getImageData(
                0, 0, canvas.width, canvas.height
            ).data;
            return pixels.some((channel, index) => index % 4 === 3 && channel > 0);
        }"""
    )


@pytest.mark.parametrize("analysis_type, field_ids", ANALYSIS_FIELDS.items())
def test_each_analysis_type_shows_its_fields(page, base_url, analysis_type, field_ids):
    open_calculator(page, base_url)
    page.locator("#testType").select_option(analysis_type)

    expect(page.locator("#dynamicFields input")).to_have_count(len(field_ids))
    for field_id in field_ids:
        expect(page.locator(f"#{field_id}")).to_be_visible()


def test_invalid_input_shows_error_without_result(page, base_url):
    open_calculator(page, base_url)
    page.locator("#exampleBtn").click()
    page.locator("#conv_control").fill("1200")
    page.locator("#calculateBtn").click()

    expect(page.locator("#errorAlert")).to_be_visible()
    expect(page.locator("#errorAlert")).to_contain_text(
        "Количество конверсий не может превышать размер выборки"
    )
    expect(page.locator("#resultCard")).to_be_hidden()


def test_malformed_backend_response_shows_error_without_result(page, base_url):
    page.route(
        "**/calculate",
        lambda route: route.fulfill(
            status=502,
            content_type="text/html",
            body="upstream unavailable",
        ),
    )
    open_calculator(page, base_url)
    page.locator("#exampleBtn").click()
    page.locator("#calculateBtn").click()

    expect(page.locator("#errorAlert")).to_be_visible()
    expect(page.locator("#errorAlert")).not_to_be_empty()
    expect(page.locator("#resultCard")).to_be_hidden()
    expect(page.locator("#calculateBtn")).to_be_enabled()


def test_calculator_controls_fit_mobile_viewport(browser, base_url):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=1,
        is_mobile=True,
    )
    page = context.new_page()
    try:
        open_calculator(page, base_url)
        expect(page.locator("#testType")).to_be_visible()
        expect(page.locator("#calculateBtn")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    finally:
        context.close()
