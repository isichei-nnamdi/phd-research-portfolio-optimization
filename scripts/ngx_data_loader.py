"""
╔══════════════════════════════════════════════════════════════╗
║  NGX Data Loader                                             ║
║  Reads manually downloaded Investing.com stock data files    ║
║  and builds cleaned analysis panels for the PhD pipeline     ║
║                                                              ║
║  Author : Isichei, Nnamdi Augustus | PHD25DTS0002 | CCS-NSUK ║
║                                                              ║
║  Folder structure expected:                                  ║
║    data/raw/ngx_stocks/                                      ║
║      CURRENT_NGX30/                                          ║
║        FINANCIAL/           ← 10 files                       ║
║        CONSUMER GOODS/      ← 5 files                        ║
║        OIL & GAS/           ← 4 files                        ║
║        INDUSTRIAL & BUILDING MATERIALS/  ← 5 files           ║
║        ICT-TELECOM/         ← 2 files                        ║
║        CONGLOMERATE-AGRO/   ← 4 files                        ║
║      FORMER_NGX30/          ← 9 files (12 listed, 3 absent)  ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
    python ngx_data_loader.py

    Or import and call individual functions:
        from ngx_data_loader import load_all_downloaded, build_panels
"""

import os
import re
import warnings
import logging
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════
# 0. CONFIGURATION — update NGXDATA_ROOT to your actual path
# ══════════════════════════════════════════════════════════════════

PROJECT_ROOT = Path(__file__).resolve().parents[1]
NGXDATA_ROOT = PROJECT_ROOT / 'data' / 'raw' / 'ngx_stocks'
PROCESSED    = PROJECT_ROOT / 'data' / 'processed'
PROCESSED.mkdir(parents=True, exist_ok=True)

START_DATE = '2012-01-01'
END_DATE   = '2025-12-31'


# ══════════════════════════════════════════════════════════════════
# 1. DATA ISSUES — read this section before proceeding
# ══════════════════════════════════════════════════════════════════

# Stocks that could not be downloaded from Investing.com.
# These will be skipped silently throughout the pipeline.
KNOWN_MISSING = {'UBN', 'DIAMONB', 'MOBIL'}

# ⚠ CRITICAL WARNING — FLOURMILLS filename mismatch
# "Northern Nigeria Flour Mills Stock Price History" is ticker NNFM,
# NOT Flour Mills of Nigeria (FLOURMILLS). They are different companies.
# Correct URL: ng.investing.com/equities/flour-mills-nigeria-historical-data
# Expected filename: "Flour Mills of Nigeria Stock Price History"
# The loader raises a DataError if the wrong file is detected.
FLOURMILLS_CORRECT_STEM  = 'Flour Mills of Nigeria Stock Price History'
FLOURMILLS_WRONG_STEM    = 'Northern Nigeria Flour Mills Stock Price History'

# ⚠ FILE SIZE WARNING — files smaller than this threshold (in bytes)
# almost certainly contain only headers, not real data.
# Redownload any file that triggers this warning while logged into
# an Investing.com account.
MIN_VALID_BYTES = 10_000   # 10 KB


# ══════════════════════════════════════════════════════════════════
# 2. FILE MAP
#    Maps each stock symbol to its location in the folder tree.
#
#    Format: symbol → {
#        'parent':  top-level folder ('CURRENT_NGX30' or 'FORMER_NGX30')
#        'sub':     sector subfolder (empty string for FORMER_NGX30)
#        'stems':   list of possible filename stems, tried in order,
#                   each attempted with .xlsx and .csv extensions
#    }
# ══════════════════════════════════════════════════════════════════

FILE_MAP = {

    # ── FINANCIAL ────────────────────────────────────────────────
    'ZENITHBANK': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Zenith Bank Stock Price History',
                  'Zenith Bank Plc Stock Price History',
                  'ZENITHBANK Stock Price History',
                  'ZENITHB Historical Data'],
    },
    'GTCO': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Guaranty Trust Holding Stock Price History',
                  'Guaranty Trust Holding Co Stock Price History',
                  'GTCO Stock Price History',
                  'GT Holding Stock Price History'],
    },
    'ACCESSCORP': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Access Holdings Stock Price History',
                  'Access Bank Stock Price History',
                  'AccessCorp Stock Price History',
                  'ACCESSCORP Stock Price History'],
    },
    'FBNH': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['First HoldCo Stock Price History',      # FIRSTHOLD
                  'FBN Holdings Stock Price History',
                  'First Bank of Nigeria Holding Stock Price History',
                  'FBNH Stock Price History',
                  'FIRSTHOLD Historical Data'],
    },
    'UBA': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['United Bank for Africa Stock Price History',
                  'UBA Stock Price History',
                  'United Bank Africa Stock Price History'],
    },
    'STANBIC': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Stanbic IBTC Holdings Stock Price History',  # IBTC
                  'IBTC Stock Price History',
                  'Stanbic IBTC Bank Stock Price History',
                  'STANBIC Stock Price History',
                  'IBTC Historical Data'],
    },
    'FIDELITYBK': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Fidelity Bank Stock Price History',          # FIDELIT
                  'FIDELIT Stock Price History',
                  'Fidelity Bank Nigeria Stock Price History',
                  'FIDELITYBK Stock Price History',
                  'FIDELIT Historical Data'],
    },
    'FCMB': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['FCMB Group Stock Price History',
                  'First City Monument Bank Stock Price History',
                  'FCMB Stock Price History'],
    },
    'ETI': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Ecobank Transnational Stock Price History',
                  'Ecobank Transnational Inc Stock Price History',
                  'ETI Stock Price History'],
    },
    'WEMABANK': {
        'parent': 'CURRENT_NGX30', 'sub': 'FINANCIAL',
        'stems': ['Wema Bank Stock Price History',
                  'Wema Bank Plc Stock Price History',
                  'WEMABANK Stock Price History',
                  'WEMABAN Historical Data'],
    },

    # ── CONSUMER GOODS ───────────────────────────────────────────
    'NESTLE': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONSUMER GOODS',
        'stems': ['Nestle Nigeria Stock Price History',
                  'Nestlé Nigeria Stock Price History',
                  'NESTLE Stock Price History'],
    },
    'DANGSUGAR': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONSUMER GOODS',
        'stems': ['Dangote Sugar Stock Price History',
                  'Dangote Sugar Refinery Stock Price History',
                  'DANGSUGAR Stock Price History',
                  'DANGSUG Historical Data'],
    },
    'NB': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONSUMER GOODS',
        'stems': ['Nigerian Breweries Stock Price History',
                  'Nigerian Breweries Plc Stock Price History',
                  'NB Stock Price History'],
    },
    'INTBREW': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONSUMER GOODS',
        'stems': ['International Breweries Stock Price History',
                  'International Breweries Plc Stock Price History',
                  'INTBREW Stock Price History'],
    },
    'BUAFOODS': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONSUMER GOODS',
        'stems': ['BUA Foods Stock Price History',
                  'BUA Foods Plc Stock Price History',
                  'BUAFOODS Stock Price History'],
    },

    # ── OIL & GAS ────────────────────────────────────────────────
    'SEPLAT': {
        'parent': 'CURRENT_NGX30', 'sub': 'OIL & GAS',
        'stems': ['Seplat Energy Stock Price History',
                  'Seplat Petroleum Stock Price History',
                  'Seplat Energy Plc Stock Price History',
                  'SEPLAT Stock Price History'],
    },
    'OANDO': {
        'parent': 'CURRENT_NGX30', 'sub': 'OIL & GAS',
        'stems': ['Oando Plc Stock Price History',
                  'Oando Stock Price History',
                  'OANDO Stock Price History'],
    },
    'TOTAL': {
        'parent': 'CURRENT_NGX30', 'sub': 'OIL & GAS',
        'stems': ['TotalEnergies Marketing Nigeria Stock Price History',
                  'Total Nigeria Stock Price History',
                  'TotalEnergies Nigeria Stock Price History',
                  'TOTAL Stock Price History'],
    },
    'ARADEL': {
        'parent': 'CURRENT_NGX30', 'sub': 'OIL & GAS',
        'stems': ['Aradel Holdings Stock Price History',
                  'Aradel Holdings Plc Stock Price History',
                  'ARADEL Stock Price History'],
    },

    # ── INDUSTRIAL & BUILDING MATERIALS ──────────────────────────
    'DANGCEM': {
        'parent': 'CURRENT_NGX30', 'sub': 'INDUSTRIAL & BUILDING MATERIALS',
        'stems': ['Dangote Cement Stock Price History',
                  'Dangote Cement Plc Stock Price History',
                  'DANGCEM Stock Price History'],
    },
    'BUACEMENT': {
        'parent': 'CURRENT_NGX30', 'sub': 'INDUSTRIAL & BUILDING MATERIALS',
        'stems': ['BUA Cement Stock Price History',
                  'BUA Cement Plc Stock Price History',
                  'BUACEMENT Stock Price History'],
    },
    'WAPCO': {
        'parent': 'CURRENT_NGX30', 'sub': 'INDUSTRIAL & BUILDING MATERIALS',
        'stems': ['Lafarge Africa Stock Price History',
                  'Lafarge Africa Plc Stock Price History',
                  'WAPCO Stock Price History',
                  'HBMNG Historical Data'],
    },
    'GEREGU': {
        'parent': 'CURRENT_NGX30', 'sub': 'INDUSTRIAL & BUILDING MATERIALS',
        'stems': ['Geregu Power Stock Price History',
                  'Geregu Power Plc Stock Price History',
                  'GEREGU Stock Price History'],
    },
    'PRESCO': {
        'parent': 'CURRENT_NGX30', 'sub': 'INDUSTRIAL & BUILDING MATERIALS',
        'stems': ['Presco Stock Price History',
                  'Presco Plc Stock Price History',
                  'PRESCO Stock Price History'],
    },

    # ── ICT-TELECOM ──────────────────────────────────────────────
    'MTNN': {
        'parent': 'CURRENT_NGX30', 'sub': 'ICT-TELECOM',
        'stems': ['MTN Nigeria Stock Price History',
                  'MTN Nigeria Communications Stock Price History',
                  'MTNN Stock Price History'],
    },
    'AIRTELAFRI': {
        'parent': 'CURRENT_NGX30', 'sub': 'ICT-TELECOM',
        'stems': ['Airtel Africa Stock Price History',
                  'Airtel Africa Plc Stock Price History',
                  'AIRTELAFRI Stock Price History'],
    },

    # ── CONGLOMERATE-AGRO ─────────────────────────────────────────
    'TRANSCORP': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONGLOMERATE-AGRO',
        'stems': ['Transcorp Stock Price History',
                  'Transnational Corporation Stock Price History',
                  'TRANSCORP Stock Price History',
                  'TRANSCO Historical Data'],
    },
    'NASCON': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONGLOMERATE-AGRO',
        'stems': ['NASCON Allied Stock Price History',
                  'NASCON Allied Industries Stock Price History',
                  'NASCON Allied Industries Plc Stock Price History',
                  'NASCON Stock Price History'],
    },
    'OKOMUOIL': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONGLOMERATE-AGRO',
        'stems': ['Okomu Oil Palm Stock Price History',
                  'Okomu Oil Palm Company Stock Price History',
                  'Okomu Oil Palm Plc Stock Price History',
                  'OKOMUOIL Stock Price History',
                  'OKOMUOI Historical Data'],
    },
    'LIVESTOCK': {
        'parent': 'CURRENT_NGX30', 'sub': 'CONGLOMERATE-AGRO',
        'stems': ['Livestock Feeds Stock Price History',
                  'Livestock Feeds Plc Stock Price History',
                  'LIVESTOCK Stock Price History',
                  'Livestock Stock Price History',
                  'LIVESTO Historical Data'],
    },

    # ── FORMER CONSTITUENTS (directly in FORMER_NGX30 folder) ────
    'CONOIL': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Conoil Stock Price History',
                  'Conoil Plc Stock Price History'],
    },
    'JBERGER': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Julius Berger Stock Price History',
                  'Julius Berger Nigeria Plc Stock Price History',
                  'Julius Berger Nigeria Stock Price History'],
    },
    'FLOURMILLS': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Flour Mills of Nigeria PLC Stock Price History',  # Investing.com name (ticker: FLOURMI)
                  FLOURMILLS_CORRECT_STEM,
                  'Flour Mills Nigeria Stock Price History',
                  'Flour Mills of Nigeria Plc Stock Price History',
                  'FLOURMI Stock Price History',
                  'FLOURMI Historical Data'],
        # Correct URL: ng.investing.com/equities/flourmill-nig-historical-data
        # Investing.com slug: flourmill-nig  (NOT flour-mills-nigeria — 404)
        # Delisted from NGX: 27 December 2024 (after exiting NGX-30 Sep 2024)
        # NOTE: 'Northern Nigeria Flour Mills Stock Price History' is NNFM,
        # a different company, and will be rejected by _check_flourmills().
    },
    'STERLINGNG': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Sterling Financial Holdings Stock Price History',
                  'Sterling Bank Stock Price History',
                  'Sterling Financial Holdings Plc Stock Price History'],
    },
    'UNILEVE': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Unilever Nigeria Stock Price History',
                  'Unilever Nigeria Plc Stock Price History'],
    },
    'PZ': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['PZ Cussons Nigeria Stock Price History',
                  'PZ Cussons Stock Price History'],
    },
    'CADBURY': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Cadbury Nigeria Stock Price History',
                  'Cadbury Nigeria Plc Stock Price History'],
    },
    'GSK': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['GSK plc DRC Stock Price History',
                  'GlaxoSmithKline Consumer Stock Price History',
                  'GlaxoSmithKline Nigeria Stock Price History',
                  'GSK Consumer Nigeria Stock Price History'],
    },
    'HONYFLOUR': {
        'parent': 'FORMER_NGX30', 'sub': '',
        'stems': ['Honeywell Flour Mills Plc Stock Price History',
                  'Honeywell Flour Mills Stock Price History',
                  'HONYFLOUR Stock Price History'],
    },
    # UBN, DIAMONB, MOBIL — not available, excluded from FILE_MAP
}


# ══════════════════════════════════════════════════════════════════
# 3. FILE DISCOVERY
# ══════════════════════════════════════════════════════════════════

def _resolve_path(symbol: str) -> Path | None:
    """
    Try every stem in FILE_MAP[symbol]['stems'] with both
    .xlsx and .csv extensions inside the configured folder.
    Returns the first matching Path or None.
    """
    if symbol in KNOWN_MISSING:
        return None

    entry   = FILE_MAP.get(symbol)
    if not entry:
        log.warning(f'{symbol}: not in FILE_MAP')
        return None

    folder = NGXDATA_ROOT / entry['parent']
    if entry['sub']:
        folder = folder / entry['sub']

    for stem in entry['stems']:
        for ext in ('.xlsx', '.csv', '.xls'):
            candidate = folder / f'{stem}{ext}'
            if candidate.exists():
                return candidate

    # Last resort: case-insensitive fuzzy scan of the folder
    if folder.exists():
        symbol_lower = symbol.lower()
        for fp in folder.iterdir():
            if fp.suffix.lower() in ('.xlsx', '.csv', '.xls'):
                if symbol_lower in fp.stem.lower():
                    log.warning(
                        f'{symbol}: used fuzzy match → {fp.name}')
                    return fp

    return None


# ══════════════════════════════════════════════════════════════════
# 4. FILE LOADING AND CLEANING
# ══════════════════════════════════════════════════════════════════

def _load_file(path: Path) -> pd.DataFrame | None:
    """Load a .csv or .xlsx file into a raw DataFrame."""
    ext = path.suffix.lower()
    try:
        if ext in ('.xlsx', '.xls'):
            df = pd.read_excel(path, engine='openpyxl')
        else:
            # Try UTF-8 first, fall back to latin-1
            for enc in ('utf-8', 'utf-8-sig', 'latin-1'):
                try:
                    df = pd.read_csv(path, encoding=enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                log.error(f'Cannot decode {path.name}')
                return None
        return df
    except Exception as exc:
        log.error(f'Cannot load {path.name}: {exc}')
        return None


def _parse_volume(val) -> float:
    """Convert Investing.com volume strings ('1.23M', '456K') to float."""
    if pd.isna(val) or str(val).strip() in ('-', '', 'N/A'):
        return 0.0
    s = str(val).replace(',', '').strip()
    for suffix, factor in (('B', 1e9), ('M', 1e6), ('K', 1e3)):
        if s.upper().endswith(suffix):
            try:
                return float(s[:-1]) * factor
            except ValueError:
                return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_price(val) -> float:
    """Convert price strings with commas to float."""
    if pd.isna(val):
        return np.nan
    return pd.to_numeric(
        str(val).replace(',', '').replace(' ', ''), errors='coerce')


def clean_stock_df(df: pd.DataFrame, symbol: str,
                   winsor_pct: float = 0.15) -> pd.DataFrame | None:
    """
    Standardise an Investing.com OHLCV DataFrame.

    Steps:
      1. Map column names (handles variations in Investing.com export format)
      2. Parse dates
      3. Parse prices and volume
      4. Compute log-returns
      5. Flag likely bonus-issue days (|return| > 20%)
      6. Winsorise returns at ± winsor_pct
      7. Restrict to study window
    """
    if df is None or df.empty:
        return None

    df = df.copy()

    # ── Step 1: Normalise column names ───────────────────────────
    # Investing.com uses slightly different headers depending on
    # whether the file was downloaded as CSV or Excel.
    col_aliases = {
        'Date':      'Date',
        'Price':     'Close',   # Investing.com labels closing price as "Price"
        'Close':     'Close',
        'Open':      'Open',
        'High':      'High',
        'Low':       'Low',
        'Vol.':      'Volume',
        'Volume':    'Volume',
        'Change %':  'Change_pct',
    }
    df.columns = [col_aliases.get(c.strip(), c.strip())
                  for c in df.columns]

    if 'Date' not in df.columns or 'Close' not in df.columns:
        log.error(f'{symbol}: required columns missing. '
                  f'Found: {list(df.columns)}')
        return None

    # ── Step 2: Parse dates ───────────────────────────────────────
    date_parsed = False
    for fmt in ('%b %d, %Y',   # Oct 01, 2026
                '%m/%d/%Y',    # 10/01/2026
                '%d/%m/%Y',    # 01/10/2026
                '%Y-%m-%d'):   # 2026-10-01
        try:
            df['Date'] = pd.to_datetime(df['Date'], format=fmt)
            date_parsed = True
            break
        except (ValueError, TypeError):
            pass

    if not date_parsed:
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')

    df = (df.dropna(subset=['Date'])
          .sort_values('Date')
          .reset_index(drop=True))

    if df.empty:
        log.error(f'{symbol}: no valid dates after parsing')
        return None

    # ── Step 3: Parse prices and volume ──────────────────────────
    df['Close']  = df['Close'].apply(_parse_price)
    df['Volume'] = df['Volume'].apply(_parse_volume) \
                   if 'Volume' in df.columns \
                   else 0.0

    for col in ('Open', 'High', 'Low'):
        if col in df.columns:
            df[col] = df[col].apply(_parse_price)

    df['Symbol'] = symbol

    # ── Step 4: Log-returns ───────────────────────────────────────
    df['LogReturn'] = np.log(df['Close'] / df['Close'].shift(1))

    # ── Step 5: Bonus-issue flag ──────────────────────────────────
    # A single-day return below −20% almost always reflects a bonus
    # issue (free share distribution) rather than a genuine loss.
    # These must be manually verified against NGX corporate actions.
    df['BonusFlag'] = df['LogReturn'] < -0.20

    # ── Step 6: Winsorise ─────────────────────────────────────────
    df['LogReturn_w'] = df['LogReturn'].clip(-winsor_pct, winsor_pct)

    # ── Step 7: Restrict to study window ─────────────────────────
    df = df[(df['Date'] >= START_DATE) & (df['Date'] <= END_DATE)]

    keep = ['Date', 'Symbol', 'Open', 'High', 'Low', 'Close',
            'Volume', 'LogReturn', 'LogReturn_w', 'BonusFlag']
    df = df[[c for c in keep if c in df.columns]]

    return df if not df.empty else None


# ══════════════════════════════════════════════════════════════════
# 5. DATA QUALITY CHECKS
# ══════════════════════════════════════════════════════════════════

def _check_file_size(path: Path, symbol: str) -> bool:
    """Warn if the file is too small to contain real historical data."""
    size = path.stat().st_size
    if size < MIN_VALID_BYTES:
        log.warning(
            f'⚠  {symbol}: file is only {size:,} bytes '
            f'({path.name}). This is too small for 13 years of daily '
            f'data. Redownload while logged into Investing.com.'
        )
        return False
    return True


def _check_flourmills(path: Path) -> bool:
    """
    Detect if the wrong FLOURMILLS file was downloaded.
    Returns True if the file looks correct, False if it is NNFM.
    """
    stem = path.stem
    # Reject files that belong to Northern Nigeria Flour Mills (NNFM),
    # which shares a name similar to Flour Mills of Nigeria (FLOURMILLS).
    if 'northern nigeria flour mills' in stem.lower():
        log.error(
            f'✗  FLOURMILLS: WRONG FILE DETECTED\n'
            f'   File: {path.name}\n'
            f'   "Northern Nigeria Flour Mills" is ticker NNFM — '
            f'a completely different company.\n'
            f'   Correct file: "{FLOURMILLS_CORRECT_STEM}.xlsx"\n'
            f'   Correct URL : ng.investing.com/equities/'
            f'flour-mills-nigeria-historical-data\n'
            f'   Action      : delete this file, download the correct '
            f'one, and rerun the loader.'
        )
        return False
    return True


def quality_report(stock_dfs: dict) -> pd.DataFrame:
    """
    Print and return a data quality summary for all loaded stocks.
    Columns: Symbol, N_rows, Start, End, Missing_pct, BonusFlags,
             ZeroVol_pct, Status.
    """
    rows = []
    bdate_idx = pd.bdate_range(START_DATE, END_DATE)
    expected  = len(bdate_idx)

    for sym, df in sorted(stock_dfs.items()):
        if df is None or df.empty:
            rows.append({
                'Symbol': sym, 'N_rows': 0,
                'Start': 'N/A', 'End': 'N/A',
                'Coverage_pct': 0.0,
                'Missing_pct': 100.0,
                'BonusFlags': 0,
                'ZeroVol_pct': 0.0,
                'Status': 'EMPTY',
            })
            continue

        n          = len(df)
        coverage   = n / expected * 100
        zero_vol   = ((df.get('Volume', pd.Series(dtype=float)) == 0)
                      .mean() * 100)
        bonus_flags = int(df.get('BonusFlag', pd.Series(False)).sum())

        rows.append({
            'Symbol':      sym,
            'N_rows':      n,
            'Start':       str(df['Date'].min().date()),
            'End':         str(df['Date'].max().date()),
            'Coverage_pct': round(coverage, 1),
            'Missing_pct': round(100 - coverage, 1),
            'BonusFlags':  bonus_flags,
            'ZeroVol_pct': round(zero_vol, 1),
            'Status': (
                'OK'          if coverage >= 70 else
                'LOW_DATA'    if 10 < coverage < 70 else
                'VERY_LOW'
            ),
        })

    report = pd.DataFrame(rows).sort_values('Symbol')
    print('\n' + '=' * 70)
    print('DATA QUALITY REPORT')
    print('=' * 70)
    print(report.to_string(index=False))
    print('=' * 70)

    ok    = (report['Status'] == 'OK').sum()
    low   = (report['Status'] == 'LOW_DATA').sum()
    empty = (report['Status'].isin(['EMPTY', 'VERY_LOW'])).sum()
    bonus = report['BonusFlags'].sum()

    print(f'\n  ✓ OK (≥70% coverage)      : {ok}')
    print(f'  ⚠ LOW_DATA (10–70%)       : {low}')
    print(f'  ✗ EMPTY / VERY_LOW (<10%) : {empty}')
    print(f'  ⚠ Bonus-issue flags total : {bonus} '
          f'(verify against NGX corporate actions)\n')

    report.to_csv(PROCESSED / 'data_quality_report.csv', index=False)
    return report


# ══════════════════════════════════════════════════════════════════
# 6. MASTER LOADER
# ══════════════════════════════════════════════════════════════════

def load_all_downloaded(file_map: dict = FILE_MAP,
                        root: Path = NGXDATA_ROOT) -> dict:
    """
    Discover, load, and clean every stock in FILE_MAP.

    Returns a dict: symbol → cleaned pd.DataFrame (or None if failed).
    Prints a loading summary and raises clear warnings for known issues.
    """
    global NGXDATA_ROOT
    NGXDATA_ROOT = Path(root)

    results  = {}
    ok_count = 0
    missing  = []
    failed   = []

    total = len(file_map)
    print(f'\nLoading {total} stocks from {NGXDATA_ROOT} ...\n')

    for i, (symbol, _) in enumerate(file_map.items(), 1):

        # Skip known unavailable stocks
        if symbol in KNOWN_MISSING:
            print(f'  [{i:02d}/{total}] {symbol:<14} SKIPPED '
                  f'(not available on Investing.com)')
            results[symbol] = None
            continue

        # Locate the file
        path = _resolve_path(symbol)

        if path is None:
            print(f'  [{i:02d}/{total}] {symbol:<14} NOT FOUND '
                  f'— check folder and filename')
            missing.append(symbol)
            results[symbol] = None
            continue

        # Special check: reject wrong FLOURMILLS file
        if symbol == 'FLOURMILLS' and not _check_flourmills(path):
            print(f'  [{i:02d}/{total}] {symbol:<14} REJECTED '
                  f'(wrong company — see error above)')
            failed.append(symbol)
            results[symbol] = None
            continue

        # File size sanity check
        size_ok = _check_file_size(path, symbol)

        # Load and clean
        raw_df  = _load_file(path)
        clean   = clean_stock_df(raw_df, symbol)

        if clean is None or clean.empty:
            status = 'FAILED (empty after cleaning)'
            failed.append(symbol)
            results[symbol] = None
        else:
            size_note = ' ⚠ small file' if not size_ok else ''
            status = (f'OK  — {len(clean):,} rows | '
                      f'{clean["Date"].min().date()} → '
                      f'{clean["Date"].max().date()}{size_note}')
            ok_count += 1
            results[symbol] = clean

        print(f'  [{i:02d}/{total}] {symbol:<14} {status}')

    print(f'\n{"="*55}')
    print(f'LOAD SUMMARY: {ok_count} OK | '
          f'{len(missing)} not found | '
          f'{len(failed)} failed | '
          f'{len(KNOWN_MISSING)} skipped (unavailable)')
    if missing:
        print(f'\n  ✗ Not found: {missing}')
        print('    Check that filenames match one of the stems in FILE_MAP.')
        print('    Tip: run scan_folder() to see what is in each folder.')
    if failed:
        print(f'\n  ✗ Failed   : {failed}')

    return results


# ══════════════════════════════════════════════════════════════════
# 7. PANEL BUILDERS
# ══════════════════════════════════════════════════════════════════

def build_panels(stock_dfs: dict,
                 out_folder: Path = PROCESSED) -> dict:
    """
    Build and save wide-format analysis panels from cleaned DataFrames.

    Outputs saved to out_folder:
      ngx_prices_wide.csv  — closing prices (date × symbol)
      ngx_returns_wide.csv — winsorised log-returns (date × symbol)
      ngx_volume_wide.csv  — daily volumes (date × symbol)

    Returns
    -------
    dict with keys 'prices', 'returns', 'volume'
    """
    out_folder = Path(out_folder)
    out_folder.mkdir(parents=True, exist_ok=True)

    valid = {sym: df for sym, df in stock_dfs.items()
             if df is not None and not df.empty}

    if not valid:
        log.error('No valid stock data to build panels from.')
        return {}

    bdate_idx = pd.bdate_range(START_DATE, END_DATE)

    def _make_wide(col: str) -> pd.DataFrame:
        parts = {}
        for sym, df in valid.items():
            if col in df.columns:
                s = df.set_index('Date')[col]
                s.index = pd.to_datetime(s.index)
                parts[sym] = s
        wide = pd.DataFrame(parts).reindex(bdate_idx)
        wide.index.name = 'Date'
        return wide

    prices  = _make_wide('Close')
    returns = _make_wide('LogReturn_w')
    volume  = _make_wide('Volume')

    prices.to_csv(out_folder  / 'ngx_prices_wide.csv')
    returns.to_csv(out_folder / 'ngx_returns_wide.csv')
    volume.to_csv(out_folder  / 'ngx_volume_wide.csv')

    print(f'\n{"="*55}')
    print('PANELS BUILT')
    print(f'{"="*55}')
    print(f'  Stocks included   : {len(valid)}')
    print(f'  Trading days      : {len(bdate_idx)}')
    print(f'  Price coverage    : '
          f'{(~prices.isna()).mean().mean()*100:.1f}% non-NaN')
    print(f'  Return coverage   : '
          f'{(~returns.isna()).mean().mean()*100:.1f}% non-NaN')
    print(f'  Saved to          : {out_folder}')

    return {'prices': prices, 'returns': returns, 'volume': volume}


# ══════════════════════════════════════════════════════════════════
# 8. DIAGNOSTIC HELPERS
# ══════════════════════════════════════════════════════════════════

def scan_folder(folder_path: str | Path = None):
    """
    Print all files found under a given folder.
    Call this when a stock is reported as NOT FOUND to see
    what filenames are actually in the folder.

    Example:
        scan_folder('data/raw/ngx_stocks/FORMER_NGX30')
        scan_folder('data/raw/ngx_stocks/CURRENT_NGX30/FINANCIAL')
    """
    root = Path(folder_path) if folder_path else NGXDATA_ROOT
    if not root.exists():
        print(f'Folder does not exist: {root}')
        return

    print(f'\nContents of: {root}')
    print('-' * 60)
    for p in sorted(root.rglob('*')):
        if p.is_file() and p.suffix.lower() in ('.csv', '.xlsx', '.xls'):
            size_kb = p.stat().st_size / 1024
            size_flag = ' ⚠ SMALL' if p.stat().st_size < MIN_VALID_BYTES else ''
            print(f'  {p.relative_to(root)}  '
                  f'({size_kb:.0f} KB){size_flag}')
    print()


def check_investing_format(path: str | Path):
    """
    Print the first 5 rows of a file to verify it matches
    the expected Investing.com column format.
    """
    path = Path(path)
    df   = _load_file(path)
    if df is None:
        return
    print(f'\nFile: {path.name}')
    print(f'Shape: {df.shape}')
    print(f'Columns: {list(df.columns)}')
    print(df.head())
    print()


# ══════════════════════════════════════════════════════════════════
# 9. ENTRY POINT — full load-and-build pipeline
# ══════════════════════════════════════════════════════════════════

if __name__ == '__main__':

    # ── Step 1: Scan your folders first to confirm what is present ─
    # Uncomment to inspect any folder:
    # scan_folder('data/raw/ngx_stocks/FORMER_NGX30')
    # scan_folder('data/raw/ngx_stocks/CURRENT_NGX30/FINANCIAL')

    # ── Step 2: Load and clean all downloaded files ────────────────
    stock_dfs = load_all_downloaded(root=NGXDATA_ROOT)

    # ── Step 3: Data quality report ───────────────────────────────
    report = quality_report(stock_dfs)

    # ── Step 4: Build wide-format panels ──────────────────────────
    panels = build_panels(stock_dfs)

    # ── Step 5: Quick sanity check on the return panel ────────────
    if panels:
        ret = panels['returns']
        print('\nReturn panel summary (annualised stats):')
        ann = ret.mean() * 252 * 100
        vol = ret.std() * (252 ** 0.5) * 100
        summary = pd.DataFrame({'Ann_Return_%': ann.round(2),
                                 'Ann_Vol_%':    vol.round(2)})
        print(summary.to_string())

    print('\nNext step: run download_macro_data() from '
          'ngx_data_downloader.py to collect macro variables.')