# Математика процентных ставок (Ceitnot)

Протокол Ceitnot использует **kink-модель** процентных ставок в духе Compound/Aave: ставка займа зависит от утилизации пула (доля занятых средств от лимита).

## Единицы измерения

- **WAD** = 10¹⁸ — для сумм долга и коллатерала.
- **RAY** = 10²⁷ — для ставок и коэффициентов.
- Все ставки заданы **в расчёте на секунду** в RAY (доля за секунду).

Пример: 1% годовых ≈ 0.01 / (365·24·3600) ≈ 3.17e-10 за секунду → в RAY: ≈ **3.17e17** (при RAY = 1e27).

---

## Утилизация

```
utilization = totalBorrows / borrowCap
```

- **totalBorrows** — текущий совокупный долг по рынку (WAD).
- **borrowCap** — лимит займов по рынку (WAD). Если 0 или займов нет, утилизация считается равной 0.
- Утилизация ограничена сверху значением **RAY** (1e27), т.е. 100%.

---

## Ставка займа (kink-модель)

Задаются параметры:

- **baseRate** — базовая ставка при нулевой утилизации (RAY/сек).
- **slope1** — наклон до «колена» (RAY/сек на единицу утилизации в RAY).
- **slope2** — наклон после «колена».
- **kink** — точка «колена» в RAY (например 0.8e27 = 80% утилизации).

**До kink (utilization ≤ kink):**

```
borrowRate = baseRate + (utilization * slope1) / RAY
```

**После kink (utilization > kink):**

```
normalRate  = baseRate + (kink * slope1) / RAY
excessUtil  = utilization - kink
borrowRate  = normalRate + (excessUtil * slope2) / RAY
```

Таким образом, после «колена» ставка растёт быстрее (slope2 обычно больше slope1), стимулируя сохранение ликвидности.

---

## Начисление процентов

- Долг хранится как **principal** (основная сумма) и масштабируется **borrow index** (или аналог глобального debt scale).
- При каждом займе, погашении, ликвидации или harvest индекс обновляется; текущий долг пользователя = principal × (currentIndex / indexAtBorrow).
- Реализация использует **WAD/RAY** арифметику и, при необходимости, **FixedPoint** для согласованного масштабирования с yield (harvest).

Конкретные формулы индекса и расчёта текущего долга см. в контракте Engine и библиотеке FixedPoint.

---

## 3 готовых пресета для запуска

Ниже примерные стартовые наборы. Для mainnet обычно начинают с консервативного и расширяют лимиты по мере стабильной работы.

### 1) Conservative launch

- **LTV**: 70%
- **Liq. Threshold**: 78%
- **Liq. Penalty**: 8%
- **Base Rate**: 1.0% APR
- **Slope 1**: 8.0% APR
- **Kink**: 80%
- **Slope 2**: 60.0% APR
- **Reserve Factor**: 15%
- **Origination Fee**: 0.20%
- **Borrow Cap**: 200,000
- **Supply Cap**: 400,000

### 2) Balanced

- **LTV**: 75%
- **Liq. Threshold**: 82%
- **Liq. Penalty**: 7%
- **Base Rate**: 1.0% APR
- **Slope 1**: 10.0% APR
- **Kink**: 80%
- **Slope 2**: 70.0% APR
- **Reserve Factor**: 12%
- **Origination Fee**: 0.10%
- **Borrow Cap**: 1,000,000
- **Supply Cap**: 2,000,000

### 3) Growth / aggressive

- **LTV**: 80%
- **Liq. Threshold**: 85%
- **Liq. Penalty**: 6%
- **Base Rate**: 0.5% APR
- **Slope 1**: 12.0% APR
- **Kink**: 85%
- **Slope 2**: 90.0% APR
- **Reserve Factor**: 10%
- **Origination Fee**: 0.05%
- **Borrow Cap**: 5,000,000
- **Supply Cap**: 10,000,000

