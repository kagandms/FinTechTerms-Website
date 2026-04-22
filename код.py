import pandas as pd
import numpy as np

# 1. ЗАГРУЗКА И ПОДГОТОВКА ДАННЫХ
df_prol = pd.read_csv('prolongations.csv')
df_fin = pd.read_csv('financial_data.csv')

# Приводим названия колонок месяцев в financial_data к нижнему регистру для удобства
month_cols = df_fin.columns[2:18]
month_map = {col: col.lower().strip() for col in month_cols}
df_fin = df_fin.rename(columns=month_map)

# Согласно ТЗ, данные по АМ (Аккаунт-менеджерам) первичны в prolongations.csv.
# Поэтому удаляем колонку Account из financial_data и подтягиваем из prolongations
df_fin = df_fin.drop(columns=['Account'])
df_fin = df_fin.merge(df_prol[['id', 'AM']], on='id', how='left')

# Хронологический список месяцев
months_ordered = [
    'ноябрь 2022', 'декабрь 2022', 'январь 2023', 'февраль 2023', 'март 2023', 
    'апрель 2023', 'май 2023', 'июнь 2023', 'июль 2023', 'август 2023', 
    'сентябрь 2023', 'октябрь 2023', 'ноябрь 2023', 'декабрь 2023', 
    'январь 2024', 'февраль 2024'
]
month_idx = {m: i for i, m in enumerate(months_ordered)}

# 2. ФУНКЦИЯ ОЧИСТКИ ЗНАЧЕНИЙ В ЯЧЕЙКАХ
def parse_val(val):
    if pd.isna(val):
        return None
    val = str(val).strip().lower()
    if val in ['стоп', 'end']:
        return 'stop'
    if val == 'в ноль':
        return 'zero'
    # Убираем неразрывные пробелы, обычные пробелы, меняем запятую на точку
    val = val.replace('\xa0', '').replace(' ', '').replace(',', '.')
    try:
        return float(val)
    except:
        return None

for m in months_ordered:
    if m in df_fin.columns:
        df_fin[m] = df_fin[m].apply(parse_val)

# 3. АГРЕГАЦИЯ ДУБЛЕЙ (ЧАСТЕЙ ОПЛАТЫ) ПО КАЖДОМУ ПРОЕКТУ
def aggregate_project_months(group):
    res = {}
    for m in months_ordered:
        if m not in group.columns:
            continue
        vals = group[m].dropna().tolist()
        if not vals:
            res[m] = 0.0
            continue
            
        if 'stop' in vals:
            res[m] = 'stop'
        else:
            # "в ноль" учитывается только если ВСЕ части оплаты равны "в ноль"
            if all(v == 'zero' for v in vals):
                res[m] = 'zero'
            else:
                res[m] = sum(v for v in vals if isinstance(v, (int, float)))
    return pd.Series(res)

agg_fin = df_fin.groupby('id').apply(aggregate_project_months).reset_index()

# 4. ОБРАБОТКА ЛОГИКИ "В НОЛЬ" И ИСКЛЮЧЕНИЙ "СТОП"
final_records = []
prol_df_clean = df_prol.drop_duplicates(subset=['id']).copy()
prol_df_clean['last_month'] = prol_df_clean['month'].str.lower().str.strip()

for idx, row in agg_fin.iterrows():
    pid = row['id']
    prol_info = prol_df_clean[prol_df_clean['id'] == pid]
    if prol_info.empty:
        continue
    last_month = prol_info.iloc[0]['last_month']
    am = prol_info.iloc[0]['AM']
    
    if last_month not in month_idx:
        continue
        
    l_idx = month_idx[last_month]
    
    # Проверка на наличие "стоп" / "end" в последний месяц реализации или ранее
    exclude = False
    for i in range(l_idx + 1):
        m = months_ordered[i]
        if row[m] == 'stop':
            exclude = True
            break
            
    if exclude:
        continue # Исключаем проект, так как он остановлен
        
    # Применение логики "в ноль" (перенос отгрузки с прошлого месяца)
    processed_row = {'id': pid, 'am': am, 'last_month': last_month, 'last_month_idx': l_idx}
    prev_val = 0.0
    
    for i in range(len(months_ordered)):
        m = months_ordered[i]
        val = row[m]
        
        if val == 'stop':
            processed_row[m] = 0.0 # Дальше отгрузок нет
            prev_val = 0.0
        elif val == 'zero':
            processed_row[m] = prev_val # берем значение предыдущего месяца
        else:
            processed_row[m] = float(val)
            prev_val = float(val)
            
    final_records.append(processed_row)

df_clean = pd.DataFrame(final_records)

# 5. РАСЧЕТ КОЭФФИЦИЕНТОВ ПРОЛОНГАЦИИ ЗА КАЖДЫЙ МЕСЯЦ
def compute_metrics(df, m_idx):
    # Коэффициент 1 (пролонгация в 1-й месяц)
    c1_projects = df[df['last_month_idx'] == (m_idx - 1)]
    m_1_col = months_ordered[m_idx - 1]
    m_col = months_ordered[m_idx]
    
    k_prol_1 = c1_projects[m_1_col].sum()
    prolonged_1 = c1_projects[m_col].sum()
    coef_1 = prolonged_1 / k_prol_1 if k_prol_1 > 0 else 0.0
    
    # Коэффициент 2 (пролонгация во 2-й месяц)
    if m_idx >= 2:
        # проекты, завершившиеся в (M-2) у которых НЕТ отгрузки в (M-1)
        c2_projects = df[(df['last_month_idx'] == (m_idx - 2)) & (df[m_1_col] == 0)]
        m_2_col = months_ordered[m_idx - 2]
        
        k_prol_2 = c2_projects[m_2_col].sum()
        prolonged_2 = c2_projects[m_col].sum()
        coef_2 = prolonged_2 / k_prol_2 if k_prol_2 > 0 else 0.0
    else:
        k_prol_2, prolonged_2, coef_2 = 0.0, 0.0, 0.0
        
    return {
        'k_prol_1': k_prol_1, 'prolonged_1': prolonged_1, 'coef_1': coef_1,
        'k_prol_2': k_prol_2, 'prolonged_2': prolonged_2, 'coef_2': coef_2
    }