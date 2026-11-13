# app.py
from flask import Flask, render_template, request, jsonify
from ab_test_analyzer.core import (
    ztest_proportions,
    ttest_means,
    chi_square_test,
    check_srm,
    calculate_mde,
)
import numpy as np
from scipy.stats import norm, t as t_dist

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/healthz')
def healthz():
    """Health check used by Render during deploys."""
    return jsonify({'status': 'ok'})


@app.route('/calculate', methods=['POST'])
def calculate():
    """
    Принимает JSON вида:
    {
      "test_type": "z_proportions",
      "params": { ... }
    }
    Возвращает результат в формате JSON.
    """
    data = request.get_json()
    test_type = data.get('test_type')
    params = data.get('params', {})

    if not test_type:
        return jsonify({'success': False, 'error': 'Не указан тип теста.'}), 400

    try:
        result = process_test(test_type, params)
        # Дополнительная гарантия: все значения в result – нативные Python-типы
        return jsonify({'success': True, 'result': result})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f'Внутренняя ошибка: {str(e)}'}), 500


def process_test(test_type, params):
    """
    Обрабатывает выбранный тип теста.
    ВСЕ числовые результаты явно приводятся к float/int,
    булевы значения – к bool, чтобы избежать проблем сериализации.
    """
    # --- Z-тест для пропорций ---
    if test_type == 'z_proportions':
        conv_control = int(params['conv_control'])
        n_control = int(params['n_control'])
        conv_test = int(params['conv_test'])
        n_test = int(params['n_test'])

        if n_control <= 0 or n_test <= 0:
            raise ValueError('Размеры выборок должны быть положительными.')
        if not (0 <= conv_control <= n_control) or not (0 <= conv_test <= n_test):
            raise ValueError('Количество конверсий не может превышать размер выборки.')

        res = ztest_proportions(conv_control, n_control, conv_test, n_test)
        z_stat = float(res['z_score'])
        p_val = float(res['p_value'])
        significant = bool(p_val < 0.05)

        p1 = conv_control / n_control
        p2 = conv_test / n_test
        diff = p2 - p1
        se = np.sqrt(p1 * (1 - p1) / n_control + p2 * (1 - p2) / n_test)
        z_crit = norm.ppf(0.975)  # возвращает float
        ci_lower = round(diff - z_crit * se, 4)
        ci_upper = round(diff + z_crit * se, 4)

        rel_change = ((p2 - p1) / p1 * 100) if p1 > 0 else float('inf')
        interpretation = (
            f"Конверсия в тестовой группе {'выше' if diff > 0 else 'ниже'} "
            f"контрольной на {abs(diff)*100:.2f} процентных пункта "
            f"({rel_change:.1f}% относительного изменения)."
        )

        return {
            'test_statistic': z_stat,
            'p_value': p_val,
            'significant': significant,
            'conclusion': 'Отвергаем нулевую гипотезу. Разница статистически значима.'
                          if significant else 'Не отвергаем нулевую гипотезу. Разница не значима.',
            'confidence_interval': [ci_lower, ci_upper],
            'interpretation': interpretation,
            'chart_data': {
                'labels': ['Контроль', 'Тест'],
                'values': [round(p1 * 100, 2), round(p2 * 100, 2)]
            }
        }

    # --- T-тест для средних (Уэлча) ---
    elif test_type == 't_means':
        mean1 = float(params['mean_control'])
        std1 = float(params['std_control'])
        n1 = int(params['n_control'])
        mean2 = float(params['mean_test'])
        std2 = float(params['std_test'])
        n2 = int(params['n_test'])

        if n1 <= 0 or n2 <= 0:
            raise ValueError('Размеры выборок должны быть положительными.')
        if std1 < 0 or std2 < 0:
            raise ValueError('Стандартные отклонения не могут быть отрицательными.')

        res = ttest_means(mean1, mean2, std1, std2, n1, n2)
        t_stat = float(res['t_statistic'])
        df = float(res['df'])
        p_val = float(res['p_value'])
        significant = bool(p_val < 0.05)

        diff = mean2 - mean1
        se = np.sqrt((std1 ** 2) / n1 + (std2 ** 2) / n2)
        t_crit = float(t_dist.ppf(0.975, df))
        ci_lower = round(diff - t_crit * se, 4)
        ci_upper = round(diff + t_crit * se, 4)

        interpretation = (
            f"Среднее в тестовой группе {'выше' if diff > 0 else 'ниже'} "
            f"контрольной на {abs(diff):.4f}. "
            f"Относительное изменение: {(diff / mean1 * 100):.1f}%."
        ) if mean1 != 0 else f"Среднее в тесте отличается от контроля на {diff:.4f}."

        return {
            'test_statistic': t_stat,
            'p_value': p_val,
            'significant': significant,
            'conclusion': 'Отвергаем нулевую гипотезу. Разница статистически значима.'
                          if significant else 'Не отвергаем нулевую гипотезу. Разница не значима.',
            'confidence_interval': [ci_lower, ci_upper],
            'interpretation': interpretation,
            'chart_data': {
                'labels': ['Контроль', 'Тест'],
                'values': [round(mean1, 4), round(mean2, 4)]
            }
        }

    # --- Хи-квадрат тест (таблица 2×2) ---
    elif test_type == 'chi_square':
        a = int(params['conv_control'])
        c = int(params['nonconv_control'])
        b = int(params['conv_test'])
        d = int(params['nonconv_test'])
        observed = [a, b, c, d]
        if any(x < 0 for x in observed):
            raise ValueError('Все ячейки таблицы должны быть неотрицательными.')

        res = chi_square_test(observed)
        chi2 = float(res['chi2_statistic'])
        p_val = float(res['p_value'])
        significant = bool(p_val < 0.05)

        return {
            'test_statistic': chi2,
            'p_value': p_val,
            'significant': significant,
            'conclusion': 'Отвергаем нулевую гипотезу о независимости. Распределения различаются значимо.'
                          if significant else 'Не отвергаем нулевую гипотезу. Различий в распределениях не выявлено.',
            'interpretation': 'Хи-квадрат тест сравнивает наблюдаемое распределение конверсий/не-конверсий с ожидаемым при условии независимости.',
            'chart_data': {
                'labels': ['Контроль', 'Тест'],
                'conv': [a, b],
                'nonconv': [c, d]
            }
        }

    # --- Проверка SRM (Sample Ratio Mismatch) ---
    elif test_type == 'srm':
        users_control = int(params['n_control'])
        users_test = int(params['n_test'])
        expected_ratio = float(params.get('expected_ratio', 0.5))

        if users_control <= 0 or users_test <= 0:
            raise ValueError('Размеры выборок должны быть положительными.')
        if not (0 < expected_ratio < 1):
            raise ValueError('Ожидаемое соотношение должно быть между 0 и 1.')

        res = check_srm(users_control, users_test, expected_ratio)
        chi2 = float(res['chi2_statistic'])
        p_val = float(res['p_value'])
        observed_ratio = float(res['observed_ratio'])
        significant = bool(p_val < 0.05)

        return {
            'test_statistic': chi2,
            'p_value': p_val,
            'significant': significant,
            'conclusion': 'Обнаружен значимый дисбаланс (SRM).' if significant
                          else 'SRM не обнаружен. Распределение соответствует ожидаемому.',
            'observed_ratio': round(observed_ratio, 4),
            'expected_ratio': expected_ratio,
            'interpretation': f'Наблюдаемая доля теста: {observed_ratio:.4f}, ожидаемая: {expected_ratio:.4f}.',
            'chart_data': None
        }

    # --- MDE (Минимально детектируемый эффект) ---
    elif test_type == 'mde':
        baseline = float(params['baseline_conversion'])
        alpha = float(params.get('alpha', 0.05))
        power = float(params.get('power', 0.8))
        n_control = int(params['n_control'])
        n_test = int(params.get('n_test', n_control))  # по умолчанию равно контролю

        if not (0 < baseline < 1):
            raise ValueError('Базовый уровень конверсии должен быть в интервале (0, 1).')
        if n_control <= 0 or n_test <= 0:
            raise ValueError('Размеры выборок должны быть положительными.')
        if not (0 < alpha < 1) or not (0 < power < 1):
            raise ValueError('Alpha и мощность должны быть в интервале (0, 1).')

        res = calculate_mde(baseline, alpha=alpha, power=power,
                            n_control=n_control, n_test=n_test,
                            equal_size=(n_control == n_test))
        mde_abs = float(res['mde_absolute'])
        mde_rel = float(res['mde_relative_percent'])

        return {
            'test_statistic': None,
            'p_value': None,
            'significant': None,
            'conclusion': 'Расчёт MDE',
            'mde_absolute': round(mde_abs, 5),
            'mde_relative_percent': round(mde_rel, 2),
            'interpretation': f'Минимально детектируемый абсолютный прирост конверсии: {mde_abs:.5f} ({mde_rel:.2f}%)',
            'chart_data': None
        }

    else:
        raise ValueError(f'Неизвестный тип теста: {test_type}')


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
