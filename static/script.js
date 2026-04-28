// static/script.js
document.addEventListener('DOMContentLoaded', function() {
    // --- Настройки тестов ---
    const testConfig = {
        z_proportions: {
            description: 'Сравнивает доли (конверсии) двух групп. Используйте, когда метрика бинарная (конверсия/не конверсия).',
            fields: [
                { id: 'conv_control', label: 'Конверсии в контроле', type: 'number', min: 0, step: 1, required: true },
                { id: 'n_control', label: 'Размер выборки контроля', type: 'number', min: 1, step: 1, required: true },
                { id: 'conv_test', label: 'Конверсии в тесте', type: 'number', min: 0, step: 1, required: true },
                { id: 'n_test', label: 'Размер выборки теста', type: 'number', min: 1, step: 1, required: true }
            ],
            example: { conv_control: 200, n_control: 1000, conv_test: 250, n_test: 1000 },
            chartType: 'bar'  // bar chart сравнения процентов
        },
        t_means: {
            description: 'Сравнивает средние значения двух групп (t-тест Уэлча, не предполагает равенство дисперсий). Подходит для непрерывных метрик (время, доход и т.п.).',
            fields: [
                { id: 'mean_control', label: 'Среднее контроля', type: 'number', step: 'any', required: true },
                { id: 'std_control', label: 'Стандартное отклонение контроля', type: 'number', min: 0, step: 'any', required: true },
                { id: 'n_control', label: 'Размер выборки контроля', type: 'number', min: 1, step: 1, required: true },
                { id: 'mean_test', label: 'Среднее теста', type: 'number', step: 'any', required: true },
                { id: 'std_test', label: 'Стандартное отклонение теста', type: 'number', min: 0, step: 'any', required: true },
                { id: 'n_test', label: 'Размер выборки теста', type: 'number', min: 1, step: 1, required: true }
            ],
            example: { mean_control: 50, std_control: 10, n_control: 500, mean_test: 52, std_test: 9, n_test: 500 },
            chartType: 'bar'
        },
        chi_square: {
            description: 'Хи-квадрат тест для таблицы сопряжённости 2×2. Проверяет, есть ли связь между группой и исходом.',
            fields: [
                { id: 'conv_control', label: 'Конверсии в контроле (a)', type: 'number', min: 0, step: 1, required: true },
                { id: 'nonconv_control', label: 'Не-конверсии в контроле (c)', type: 'number', min: 0, step: 1, required: true },
                { id: 'conv_test', label: 'Конверсии в тесте (b)', type: 'number', min: 0, step: 1, required: true },
                { id: 'nonconv_test', label: 'Не-конверсии в тесте (d)', type: 'number', min: 0, step: 1, required: true }
            ],
            example: { conv_control: 200, nonconv_control: 800, conv_test: 250, nonconv_test: 750 },
            chartType: 'stacked'  // stacked bar chart
        },
        srm: {
            description: 'Проверка Sample Ratio Mismatch: соответствует ли фактическое распределение пользователей по группам ожидаемому.',
            fields: [
                { id: 'n_control', label: 'Размер выборки контроля', type: 'number', min: 1, step: 1, required: true },
                { id: 'n_test', label: 'Размер выборки теста', type: 'number', min: 1, step: 1, required: true },
                { id: 'expected_ratio', label: 'Ожидаемая доля теста', type: 'number', min: 0.01, max: 0.99, step: 0.01, value: 0.5, required: false }
            ],
            example: { n_control: 10000, n_test: 9500, expected_ratio: 0.5 },
            chartType: null
        },
        mde: {
            description: 'Минимально детектируемый эффект: какой минимальный прирост конверсии можно зафиксировать при заданных параметрах.',
            fields: [
                { id: 'baseline_conversion', label: 'Базовый уровень конверсии (0–1)', type: 'number', min: 0.001, max: 0.999, step: 0.01, required: true },
                { id: 'n_control', label: 'Размер выборки контроля', type: 'number', min: 1, step: 1, required: true },
                { id: 'n_test', label: 'Размер выборки теста (если не равно контролю)', type: 'number', min: 1, step: 1, required: false },
                { id: 'alpha', label: 'Уровень значимости α', type: 'number', min: 0.01, max: 0.2, step: 0.01, value: 0.05, required: false },
                { id: 'power', label: 'Мощность (1-β)', type: 'number', min: 0.5, max: 0.99, step: 0.01, value: 0.8, required: false }
            ],
            example: { baseline_conversion: 0.1, n_control: 5000, n_test: 5000, alpha: 0.05, power: 0.8 },
            chartType: null
        }
    };

    // DOM элементы
    const testTypeSelect = document.getElementById('testType');
    const testDescription = document.getElementById('testDescription');
    const dynamicFields = document.getElementById('dynamicFields');
    const calculateBtn = document.getElementById('calculateBtn');
    const exampleBtn = document.getElementById('exampleBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultCard = document.getElementById('resultCard');
    const resultBody = document.getElementById('resultBody');
    const copyBtn = document.getElementById('copyBtn');
    const errorAlert = document.getElementById('errorAlert');
    const chartContainer = document.getElementById('chartContainer');
    const calcSpinner = document.getElementById('calcSpinner');

    let chartInstance = null;  // текущий экземпляр Chart.js

    // Функция обновления формы в зависимости от выбранного теста
    function updateForm() {
        const type = testTypeSelect.value;
        const config = testConfig[type];
        testDescription.textContent = config.description;

        // Очистить предыдущие поля
        dynamicFields.innerHTML = '';
        config.fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            const label = document.createElement('label');
            label.htmlFor = field.id;
            label.className = 'form-label';
            label.textContent = field.label;
            const input = document.createElement('input');
            input.type = field.type;
            input.id = field.id;
            input.className = 'form-control';
            if (field.min !== undefined) input.min = field.min;
            if (field.max !== undefined) input.max = field.max;
            if (field.step) input.step = field.step;
            if (field.value !== undefined) input.value = field.value;
            input.required = field.required || false;
            div.appendChild(label);
            div.appendChild(input);
            dynamicFields.appendChild(div);
        });

        // Сбросить результаты и ошибки
        hideResults();
        hideError();
    }

    // Заполнение полей примером
    function fillExample() {
        const type = testTypeSelect.value;
        const example = testConfig[type].example;
        for (const [id, value] of Object.entries(example)) {
            const input = document.getElementById(id);
            if (input) input.value = value;
        }
        hideResults();
        hideError();
    }

    // Сброс всех полей
    function resetForm() {
        updateForm();
    }

    // Сбор параметров из формы
    function gatherParams() {
        const type = testTypeSelect.value;
        const config = testConfig[type];
        const params = {};
        config.fields.forEach(field => {
            const input = document.getElementById(field.id);
            if (input) {
                let value = input.value.trim();
                if (value === '') {
                    // Если поле необязательное, пропускаем (MDE n_test)
                    if (!field.required) return;
                    throw new Error(`Поле "${field.label}" обязательно для заполнения.`);
                }
                params[field.id] = value;
            }
        });
        return params;
    }

    // Отображение ошибки
    function showError(message) {
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
    }

    function hideError() {
        errorAlert.classList.add('d-none');
    }

    // Показ/скрытие результатов
    function hideResults() {
        resultCard.classList.add('d-none');
        if (chartContainer) {
            chartContainer.classList.add('d-none');
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
        }
    }

    function showResults(result) {
        // Формирование HTML карточки результата
        let html = '<dl class="row mb-0">';
        if (result.test_statistic !== undefined && result.test_statistic !== null) {
            html += `<dt class="col-sm-5">Статистика теста</dt><dd class="col-sm-7">${result.test_statistic}</dd>`;
        }
        if (result.p_value !== undefined && result.p_value !== null) {
            html += `<dt class="col-sm-5">P-значение</dt><dd class="col-sm-7">${result.p_value}</dd>`;
        }
        if (result.confidence_interval) {
            html += `<dt class="col-sm-5">95% ДИ для разности</dt><dd class="col-sm-7">[${result.confidence_interval[0]}, ${result.confidence_interval[1]}]</dd>`;
        }
        if (result.observed_ratio !== undefined) {
            html += `<dt class="col-sm-5">Наблюдаемая доля теста</dt><dd class="col-sm-7">${result.observed_ratio}</dd>`;
        }
        if (result.mde_absolute !== undefined) {
            html += `<dt class="col-sm-5">MDE абсолютный</dt><dd class="col-sm-7">${result.mde_absolute}</dd>`;
            html += `<dt class="col-sm-5">MDE относительный (%)</dt><dd class="col-sm-7">${result.mde_relative_percent}%</dd>`;
        }
        html += '</dl>';

        // Вывод заключения с цветовой индикацией
        if (result.conclusion) {
            const badgeClass = result.significant ? 'bg-danger' : (result.significant === false ? 'bg-success' : 'bg-secondary');
            html += `<div class="mt-2"><span class="badge ${badgeClass} fs-6">${result.conclusion}</span></div>`;
        }

        if (result.interpretation) {
            html += `<p class="mt-2 mb-0 text-muted">${result.interpretation}</p>`;
        }

        resultBody.innerHTML = html;
        resultCard.classList.remove('d-none');
    }

    // Построение графика, если есть данные
    function renderChart(chartData, chartType) {
        if (!chartData || !chartContainer) return;
        chartContainer.classList.remove('d-none');

        const ctx = document.getElementById('resultChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        if (chartType === 'bar') {
            // Простой bar chart для z-теста или t-теста
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: 'Значение',
                        data: chartData.values,
                        backgroundColor: ['#0d6efd', '#198754']
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true } }
                }
            });
        } else if (chartType === 'stacked') {
            // stacked bar для хи-квадрат
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: 'Конверсии',
                            data: chartData.conv,
                            backgroundColor: '#198754'
                        },
                        {
                            label: 'Не-конверсии',
                            data: chartData.nonconv,
                            backgroundColor: '#adb5bd'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true }
                    }
                }
            });
        }
    }

    // Отправка запроса на расчёт
    async function calculate() {
        hideError();
        // Валидация на клиенте
        let params;
        try {
            params = gatherParams();
        } catch (e) {
            showError(e.message);
            return;
        }

        // Показываем спиннер
        calcSpinner.classList.remove('d-none');
        calculateBtn.disabled = true;

        try {
            const response = await fetch('/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test_type: testTypeSelect.value,
                    params: params
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Ошибка сервера');
            }

            // Отображаем результат
            showResults(data.result);

            // Рисуем график, если есть данные
            const chartType = testConfig[testTypeSelect.value].chartType;
            if (chartType && data.result.chart_data) {
                renderChart(data.result.chart_data, chartType);
            } else {
                // скрываем старый график, если новый не нужен
                chartContainer.classList.add('d-none');
                if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
            }

        } catch (err) {
            showError(err.message);
            hideResults();
        } finally {
            calcSpinner.classList.add('d-none');
            calculateBtn.disabled = false;
        }
    }

    // Копирование текста результата
    function copyResult() {
        const text = resultBody.innerText;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const origText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Скопировано!';
            setTimeout(() => { copyBtn.innerHTML = origText; }, 1500);
        }).catch(() => alert('Не удалось скопировать.'));
    }

    // Привязка событий
    testTypeSelect.addEventListener('change', updateForm);
    exampleBtn.addEventListener('click', fillExample);
    resetBtn.addEventListener('click', resetForm);
    calculateBtn.addEventListener('click', calculate);
    copyBtn.addEventListener('click', copyResult);

    // Инициализация формы при загрузке
    updateForm();
});