from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import expect

from tests.e2e.test_browser_smoke import open_calculator


axe = Axe()


def assert_no_critical_or_serious_violations(page):
    results = axe.run(page)
    violations = [
        violation
        for violation in results.response["violations"]
        if violation.get("impact") in {"critical", "serious"}
    ]
    assert not violations, "Accessibility violations:\n" + "\n".join(
        f"{violation['impact']}: {violation['id']} - {violation['help']} "
        f"({[node['target'] for node in violation['nodes']]})"
        for violation in violations
    )


def test_calculator_has_no_serious_accessibility_violations(page, base_url):
    open_calculator(page, base_url)
    assert_no_critical_or_serious_violations(page)

    page.locator("#exampleBtn").click()
    page.locator("#calculateBtn").click()
    expect(page.locator("#resultCard")).to_be_visible()
    assert_no_critical_or_serious_violations(page)


def test_main_flow_can_be_completed_with_keyboard(page, base_url):
    open_calculator(page, base_url)

    page.keyboard.press("Tab")
    expect(page.locator(".skip-link")).to_be_focused()
    page.keyboard.press("Tab")
    expect(page.locator("#testType")).to_be_focused()

    values = ["200", "1000", "250", "1000"]
    for field_id, value in zip(
        ["conv_control", "n_control", "conv_test", "n_test"], values
    ):
        page.keyboard.press("Tab")
        expect(page.locator(f"#{field_id}")).to_be_focused()
        page.keyboard.type(value)

    page.keyboard.press("Tab")
    expect(page.locator("#calculateBtn")).to_be_focused()
    page.keyboard.press("Enter")

    expect(page.locator("#resultCard")).to_be_visible()
    expect(page.locator("#resultCard")).to_be_focused()
    expect(page.locator("#resultBody")).to_contain_text("P-значение")


def test_dynamic_fields_have_labels_and_accessible_validation(page, base_url):
    open_calculator(page, base_url)

    field = page.get_by_label("Конверсии в контроле", exact=True)
    expect(field).to_be_visible()
    page.locator("#calculateBtn").click()

    expect(field).to_have_attribute("aria-invalid", "true")
    expect(field).to_have_attribute("aria-describedby", "conv_control-feedback")
    expect(page.locator("#conv_control-feedback")).to_be_visible()
    expect(field).to_be_focused()
    expect(page.locator("#errorAlert")).to_have_attribute("role", "alert")


def test_backend_error_is_exposed_as_an_assertive_alert(page, base_url):
    page.route(
        "**/calculate",
        lambda route: route.fulfill(
            status=500,
            content_type="application/json",
            body='{"success": false, "error": "Сервис временно недоступен"}',
        ),
    )
    open_calculator(page, base_url)
    page.locator("#exampleBtn").click()
    page.locator("#calculateBtn").click()

    alert = page.locator("#errorAlert")
    expect(alert).to_be_visible()
    expect(alert).to_have_attribute("aria-live", "assertive")
    expect(alert).to_contain_text("Сервис временно недоступен")
    expect(alert).to_be_focused()
