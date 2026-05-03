# Вывод комиссий и резервов через Governor + Timelock

Инструкция для **Arbitrum One** и деплоя с адресами из `frontend/.env` (подставь свои, если сеть/деплой другие).

**Условие:** у контрактов PSM / Engine поле **`admin` = `TimelockController`**, а у Timelock **`PROPOSER_ROLE`** только у **`CeitnotGovernor`**. Тогда вывод делается цепочкой:

`propose` → **1 день** (`votingDelay`) → голосование **до 7 дней** (`votingPeriod`) → при успехе `queue` → **`getMinDelay()`** таймлока → `execute`.

Параметры Governor в `CeitnotGovernor`: порог пропозера **100_000e18** голосов VeCeitnot, кворум **4%**.

---

## Переменные (PowerShell)

```powershell
$RPC = "https://arb1.arbitrum.io/rpc"
$GOV = "0x70DF0a55aCf6D2DC2C8C236DA6E2C602A8BC5cD1"
$TL  = "0x26A46142901F14196132Ea212970Cf13286Dc32D"
$PSM = "0xc3DeA5605DDEA1Cb768c040D5FD14ec6DedFbB54"
$ENGINE = "0xf8631eA8D16f67A4FfBAb691dcF55c6d0D31b928"
$TREASURY = "0x4D8FC1F286644c9098Eb39FBe0C7aCcbeCd9bc7D"
$PK = $env:PRIVATE_KEY
```

`$PK` — ключ кошелька **пропозера** с достаточным **VeCeitnot** на снимке `clock() - 1`.

---

## Состояния предложения (OZ `ProposalState`)

Удобно смотреть: `cast call $GOV "state(uint256)(uint8)" $PID --rpc-url $RPC`

| uint8 | Имя       | Когда действовать        |
|-------|-----------|---------------------------|
| 0     | Pending   | Ждать открытия голосования |
| 1     | Active    | Вызывать `castVote`       |
| 4     | Succeeded | Вызывать `queue`          |
| 5     | Queued    | Ждать `getMinDelay`, потом `execute` |

---

## Хеш описания для `queue` / `execute`

В OpenZeppelin Governor: `descriptionHash = keccak256(bytes(description))`, строка **`$DESC`** должна быть **байт-в-байт той же**, что в `propose`.

```powershell
$DESC = "AIP-PSM-1: Withdraw feeReserves to treasury"
$hex = '0x' + ([System.BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($DESC)) -replace '-','').ToLowerInvariant()
$DESC_HASH = cast keccak $hex
```

Для **каждого нового** предложения используй **новую** уникальную строку `$DESC`.

---

## A) PSM — `withdrawFeeReserves` (USDC **6 decimals**)

### 1. Прочитать накопленные комиссии

```powershell
cast call $PSM "feeReserves()(uint256)" --rpc-url $RPC
```

Подставь результат в **`$AMOUNT`** (сырой `uint256`, без точки).

### 2. Собрать calldata и отправить `propose`

```powershell
$AMOUNT = 199900000
$ACTION = cast calldata "withdrawFeeReserves(address,uint256)" $TREASURY $AMOUNT

cast send $GOV "propose(address[],uint256[],bytes[],string)" "[$PSM]" "[0]" "[$ACTION]" $DESC --rpc-url $RPC --private-key $PK
```

### 3. Получить `proposalId`

```powershell
$PID = cast call $GOV "hashProposal(address[],uint256[],bytes[],bytes32)(uint256)" "[$PSM]" "[0]" "[$ACTION]" $DESC_HASH --rpc-url $RPC
```

### 4. После `votingDelay` — голос «За» (1)

```powershell
cast call $GOV "state(uint256)(uint8)" $PID --rpc-url $RPC
cast send $GOV "castVote(uint256,uint8)" $PID 1 --rpc-url $RPC --private-key $PK
```

### 5. После `Succeeded` — `queue`

```powershell
cast send $GOV "queue(address[],uint256[],bytes[],bytes32)" "[$PSM]" "[0]" "[$ACTION]" $DESC_HASH --rpc-url $RPC --private-key $PK
```

### 6. Задержка таймлока

```powershell
cast call $TL "getMinDelay()(uint256)" --rpc-url $RPC
```

Подожди не меньше этого числа **секунд** после успешного `queue`.

### 7. `execute`

```powershell
cast send $GOV "execute(address[],uint256[],bytes[],bytes32)" "[$PSM]" "[0]" "[$ACTION]" $DESC_HASH --rpc-url $RPC --private-key $PK
```

`execute` оплачивает газ отправитель; при `EXECUTOR_ROLE` на `address(0)` исполнить может любой кошелёк с ETH.

---

## B) Engine (прокси) — `withdrawReserves` (ceitUSD, **18 decimals**)

Сумма по рынку (пример `marketId = 0`):

```powershell
$MID = 0
cast call $ENGINE "getMarketTotalReserves(uint256)(uint256)" $MID --rpc-url $RPC
```

Новое описание и хеш, затем:

```powershell
$DESC = "AIP-ENG-1: Withdraw market 0 reserves to treasury"
$hex = '0x' + ([System.BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($DESC)) -replace '-','').ToLowerInvariant()
$DESC_HASH = cast keccak $hex

$WAD = 1000000000000000000
$ACTION = cast calldata "withdrawReserves(uint256,uint256,address)" $MID $WAD $TREASURY

cast send $GOV "propose(address[],uint256[],bytes[],string)" "[$ENGINE]" "[0]" "[$ACTION]" $DESC --rpc-url $RPC --private-key $PK
$PID = cast call $GOV "hashProposal(address[],uint256[],bytes[],bytes32)(uint256)" "[$ENGINE]" "[0]" "[$ACTION]" $DESC_HASH --rpc-url $RPC
```

Дальше: **`state` → `castVote 1` → `queue`** с теми же `"[$ENGINE]"`, `"[0]"`, `"[$ACTION]"`, `$DESC_HASH` → задержка → **`execute`** с теми же аргументами.

---

## C) Engine — `withdrawFlashLoanReserves`

```powershell
cast call $ENGINE "getFlashLoanReserves()(uint256)" --rpc-url $RPC
```

```powershell
$DESC = "AIP-ENG-FL1: Withdraw flash loan reserves"
$hex = '0x' + ([System.BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($DESC)) -replace '-','').ToLowerInvariant()
$DESC_HASH = cast keccak $hex

$WAD = 500000000000000000
$ACTION = cast calldata "withdrawFlashLoanReserves(address,uint256)" $TREASURY $WAD

cast send $GOV "propose(address[],uint256[],bytes[],string)" "[$ENGINE]" "[0]" "[$ACTION]" $DESC --rpc-url $RPC --private-key $PK
$PID = cast call $GOV "hashProposal(address[],uint256[],bytes[],bytes32)(uint256)" "[$ENGINE]" "[0]" "[$ACTION]" $DESC_HASH --rpc-url $RPC
```

Снова **vote → queue → delay → execute** с тем же payload.

---

## D) Engine — `withdrawProtocolCollateral` (shares vault)

```powershell
cast call $ENGINE "getProtocolCollateralReserves(uint256)(uint256)" 0 --rpc-url $RPC
```

```powershell
$DESC = "AIP-ENG-PC1: Withdraw protocol liquidation shares m0"
$hex = '0x' + ([System.BitConverter]::ToString([Text.Encoding]::UTF8.GetBytes($DESC)) -replace '-','').ToLowerInvariant()
$DESC_HASH = cast keccak $hex

$SHARES = 1000000000000000000
$ACTION = cast calldata "withdrawProtocolCollateral(uint256,uint256,address)" 0 $SHARES $TREASURY

cast send $GOV "propose(address[],uint256[],bytes[],string)" "[$ENGINE]" "[0]" "[$ACTION]" $DESC --rpc-url $RPC --private-key $PK
$PID = cast call $GOV "hashProposal(address[],uint256[],bytes[],bytes32)(uint256)" "[$ENGINE]" "[0]" "[$ACTION]" $DESC_HASH --rpc-url $RPC
```

Дальше тот же цикл **vote → queue → delay → execute**.

---

## Важные замечания

1. **`$DESC` не менять** между `propose` / `queue` / `execute`; **`$ACTION`**, **`$DESC_HASH`**, **`[$PSM]`** / **`[$ENGINE]`** в `queue` и `execute` должны совпадать с `propose`.
2. **`$AMOUNT`** для PSM не больше **`feeReserves`**; для Engine — не больше **`getMarketTotalReserves`** / **`getFlashLoanReserves`** / **`getProtocolCollateralReserves`**.
3. Если **`admin` у PSM/Engine ещё EOA**, проще вывести с **Admin UI** или прямым `cast send` на PSM/Engine без Governor.
4. Если **`propose`** ревертится — проверь **ve-голоса** пропозера и текст описания (OZ **restricted proposer** по `#proposer=` в описании, если включено в билде Governor).

---

## Где смотреть суммы на Arbiscan

- **PSM:** Read Contract → **`feeReserves`**.
- **Engine (прокси):** после **Proxy verification** → **Read as Proxy** → **`getMarketTotalReserves`**, **`getFlashLoanReserves`**, **`getProtocolCollateralReserves`**.

См. также обсуждение в репозитории: комиссии учитываются на **PSM/Engine**, не на адресе Timelock.

---

*Документ добавлен локально; в удалённый git не пушился по запросу.*
