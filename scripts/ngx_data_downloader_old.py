"""
╔══════════════════════════════════════════════════════════════╗
║  NGX Data Downloader — PhD Research Data Pipeline            ║
║  Machine Learning-Enhanced Portfolio Optimisation for NGX    ║
║  Author : Isichei, Nnamdi Augustus | PHD25DTS0002 | CCS-NSUK ║
║                                                              ║
║  Collects:                                                   ║
║    ① NGX-30 OHLCV prices   (Investing.com)  2012-2025        ║
║    ② Macroeconomic data    (FRED + CBN + WB) 2012-2025       ║
║    ③ Sentiment data        (News + NLP)       2012-2025      ║
╚══════════════════════════════════════════════════════════════╝

INSTALLATION (run once):
    pip install selenium webdriver-manager pandas requests
        beautifulsoup4 vaderSentiment feedparser tqdm
        fredapi arch statsmodels

    Optional (better financial NLP):
        pip install transformers torch  # for FinBERT
"""

# ── Standard library ─────────────────────────────────────────────
import os
import re
import time
import json
import logging
import warnings
from datetime import datetime, timedelta
from pathlib import Path

# ── Data handling ─────────────────────────────────────────────────
import pandas as pd
import numpy as np

# ── Web & scraping ────────────────────────────────────────────────
import requests
from bs4 import BeautifulSoup
import feedparser

# ── Selenium ──────────────────────────────────────────────────────
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import (
    TimeoutException, NoSuchElementException, ElementClickInterceptedException
)
from webdriver_manager.chrome import ChromeDriverManager

# ── NLP ───────────────────────────────────────────────────────────
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [%(levelname)s] %(message)s',
                    datefmt='%H:%M:%S')
log = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════
# 0. GLOBAL CONFIGURATION
# ══════════════════════════════════════════════════════════════════

START_DATE  = '01/01/2012'     # Investing.com format MM/DD/YYYY
END_DATE    = '31/12/2025'     # Investing.com format MM/DD/YYYY
FRED_START  = '2012-01-01'     # FRED / pandas format YYYY-MM-DD
FRED_END    = '2025-12-31'

BASE_DIR    = Path('ngx_research_data')
RAW_PRICES  = BASE_DIR / 'raw' / 'prices'
RAW_MACRO   = BASE_DIR / 'raw' / 'macro'
RAW_SENT    = BASE_DIR / 'raw' / 'sentiment'
PROCESSED   = BASE_DIR / 'processed'
LOGS        = BASE_DIR / 'logs'

for d in [RAW_PRICES, RAW_MACRO, RAW_SENT, PROCESSED, LOGS]:
    d.mkdir(parents=True, exist_ok=True)


# ══════════════════════════════════════════════════════════════════
# 1. NGX-30 STOCK UNIVERSE
#
#    Three structures are defined:
#
#    CURRENT_NGX30   — stocks in the index as at December 2025
#    FORMER_NGX30    — stocks that were in the index at any point
#                      during 2012-2025 but have since been removed;
#                      includes the 9 rebalancing-drop stocks plus
#                      merger/acquisition exits with clean data
#    INDEX_MEMBERSHIP — point-in-time entry and exit dates for every
#                       stock, enabling survivorship-bias-corrected
#                       backtesting
#
#    Investing.com slug = the URL segment in:
#    https://ng.investing.com/equities/{slug}-historical-data
#
#    SURVIVORSHIP BIAS NOTE
#    ──────────────────────
#    Including former constituents is essential for research validity.
#    A backtest restricted to current members retrospectively selects
#    only stocks that survived to the end of the study window, inflating
#    reported performance.  The point-in-time panel in get_universe_at()
#    ensures the GAT trains and is evaluated only on stocks that were
#    actually investable at each historical rebalancing date.
# ══════════════════════════════════════════════════════════════════


# ── 1A. CURRENT CONSTITUENTS (December 2025) ──────────────────────
# CADBURY (dropped 2021) and FLOURMILLS (dropped 2024) have been
# moved to FORMER_NGX30.  WEMABANK is added as a 2025 replacement.

CURRENT_NGX30 = [
    # ── FINANCIAL (10 stocks) ────────────────────────────────────
    {'symbol': 'ZENITHBANK',  'slug': 'zenith-bank',
     'sector': 'Financial',   'name': 'Zenith Bank Plc'},
    {'symbol': 'GTCO',        'slug': 'guaranty-trust-holding',
     'sector': 'Financial',   'name': 'Guaranty Trust Holding Co.'},
    {'symbol': 'ACCESSCORP',  'slug': 'access-holdings',
     'sector': 'Financial',   'name': 'Access Holdings Plc'},
    {'symbol': 'FBNH',        'slug': 'fbn-holdings', #FIRSTHOLD
     'sector': 'Financial',   'name': 'FBN Holdings Plc'},
    {'symbol': 'UBA',         'slug': 'united-bank-for-africa',
     'sector': 'Financial',   'name': 'United Bank for Africa'},
    {'symbol': 'STANBIC',     'slug': 'stanbic-ibtc-holdings', #IBTC
     'sector': 'Financial',   'name': 'Stanbic IBTC Holdings'},
    {'symbol': 'FIDELITYBK',  'slug': 'fidelity-bank', #FIDELIT
     'sector': 'Financial',   'name': 'Fidelity Bank Plc'},
    {'symbol': 'FCMB',        'slug': 'fcmb-group',
     'sector': 'Financial',   'name': 'FCMB Group Plc'},
    {'symbol': 'ETI',         'slug': 'ecobank-transnational',
     'sector': 'Financial',   'name': 'Ecobank Transnational Inc.'},
    {'symbol': 'WEMABANK',    'slug': 'wema-bank', #Wema Bank Stock Price History
     'sector': 'Financial',   'name': 'Wema Bank Plc'},

    # ── CONSUMER GOODS (5 stocks) ────────────────────────────────
    {'symbol': 'NESTLE',      'slug': 'nestle-nigeria', #Nestle Nigeria Stock Price History
     'sector': 'Consumer',    'name': 'Nestle Nigeria Plc'},
    {'symbol': 'DANGSUGAR',   'slug': 'dangote-sugar', #Dangote Sugar Stock Price History
     'sector': 'Consumer',    'name': 'Dangote Sugar Refinery'},
    {'symbol': 'NB',          'slug': 'nigerian-breweries', #Nigerian Breweries Stock Price History
     'sector': 'Consumer',    'name': 'Nigerian Breweries Plc'},
    {'symbol': 'INTBREW',     'slug': 'international-breweries', #International Breweries Stock Price History
     'sector': 'Consumer',    'name': 'International Breweries Plc'},
    {'symbol': 'BUAFOODS',    'slug': 'bua-foods', #BUA Foods Stock Price History
     'sector': 'Consumer',    'name': 'BUA Foods Plc'},

    # ── OIL & GAS (4 stocks) ─────────────────────────────────────
    {'symbol': 'SEPLAT',      'slug': 'seplat-petroleum', #Seplat Energy Stock Price History
     'sector': 'Oil&Gas',     'name': 'Seplat Energy Plc'},
    {'symbol': 'OANDO',       'slug': 'oando', #Oando Plc Stock Price History
     'sector': 'Oil&Gas',     'name': 'Oando Plc'},
    {'symbol': 'TOTAL',       'slug': 'total-nigeria', #TotalEnergies Marketing Nigeria Stock Price History
     'sector': 'Oil&Gas',     'name': 'TotalEnergies Marketing Nigeria'},
    {'symbol': 'ARADEL',      'slug': 'aradel-holdings', #Aradel Holdings Stock Price History
     'sector': 'Oil&Gas',     'name': 'Aradel Holdings Plc'},

    # ── INDUSTRIAL / BUILDING MATERIALS (5 stocks) ───────────────
    {'symbol': 'DANGCEM',     'slug': 'dangote-cement', #Dangote Cement Stock Price History
     'sector': 'Industrial',  'name': 'Dangote Cement Plc'},
    {'symbol': 'BUACEMENT',   'slug': 'bua-cement', #BUA Cement Stock Price History
     'sector': 'Industrial',  'name': 'BUA Cement Plc'},
    {'symbol': 'WAPCO',       'slug': 'lafarge-africa', #Lafarge Africa Stock Price History
     'sector': 'Industrial',  'name': 'Lafarge Africa Plc'},
    {'symbol': 'GEREGU',      'slug': 'geregu-power', #Geregu Power Stock Price History
     'sector': 'Industrial',  'name': 'Geregu Power Plc'},
    {'symbol': 'PRESCO',      'slug': 'presco', #Presco Stock Price History
     'sector': 'Industrial',  'name': 'Presco Plc'},

    # ── ICT / TELECOM (2 stocks) ─────────────────────────────────
    {'symbol': 'MTNN',        'slug': 'mtn-nigeria', #MTN Nigeria Stock Price History
     'sector': 'ICT',         'name': 'MTN Nigeria Communications'},
    {'symbol': 'AIRTELAFRI',  'slug': 'airtel-africa', #Airtel Africa Stock Price History
     'sector': 'ICT',         'name': 'Airtel Africa Plc'},

    # ── CONGLOMERATE / AGRO (4 stocks) ───────────────────────────
    {'symbol': 'TRANSCORP',   'slug': 'transcorp', #Transcorp Stock Price History
     'sector': 'Conglomerate','name': 'Transnational Corporation'},
    {'symbol': 'NASCON',      'slug': 'nascon-allied-industries', #NASCON Allied Stock Price History
     'sector': 'Consumer',    'name': 'NASCON Allied Industries Plc'},
    {'symbol': 'OKOMUOIL',    'slug': 'okomu-oil-palm', #Okomu Oil Palm Stock Price History
     'sector': 'Agro',        'name': 'Okomu Oil Palm Company'},
    {'symbol': 'LIVESTOCK',   'slug': 'livestock-feeds', #Livestock Stock Price History
     'sector': 'Agro',        'name': 'Livestock Feeds Plc'},
]


# ── 1B. FORMER CONSTITUENTS (Dropped 2012-2025) ───────────────────
# Ordered newest exit first for readability.
# Skip reason codes:
#   REBALANCING  — removed at a scheduled index review
#   MERGED       — absorbed into another listed entity
#   DELISTED     — voluntarily or forcibly removed from exchange

FORMER_NGX30 = [
    # ── Nine rebalancing-drop stocks (clean data, full priority) ─
    {'symbol': 'CONOIL',      'slug': 'conoil', #Conoil Stock Price History
     'sector': 'Oil&Gas',     'name': 'Conoil Plc',
     'exit': '2025-03-31',    'reason': 'REBALANCING'},

    {'symbol': 'JBERGER',     'slug': 'julius-berger-nigeria', #Julius Berger Stock Price History
     'sector': 'Industrial',  'name': 'Julius Berger Nigeria Plc',
     'exit': '2025-03-31',    'reason': 'REBALANCING'},

    {'symbol': 'FLOURMILLS',  'slug': 'flour-mills-nigeria', #Northern Nigeria Flour Mills Stock Price History
     'sector': 'Consumer',    'name': 'Flour Mills of Nigeria Plc',
     'exit': '2024-09-30',    'reason': 'REBALANCING'},

    {'symbol': 'STERLINGNG',  'slug': 'sterling-bank', #Sterling Financial Holdings Stock Price History
     'sector': 'Financial',   'name': 'Sterling Financial Holdings Plc',
     'exit': '2024-09-30',    'reason': 'REBALANCING'},

    {'symbol': 'UNILEVE',     'slug': 'unilever-nigeria', #Unilever Nigeria Stock Price History
     'sector': 'Consumer',    'name': 'Unilever Nigeria Plc',
     'exit': '2023-06-30',    'reason': 'REBALANCING'},

    {'symbol': 'PZ',          'slug': 'pz-cussons-nigeria', #PZ Cussons Nigeria Stock Price History
     'sector': 'Consumer',    'name': 'PZ Cussons Nigeria Plc',
     'exit': '2022-06-30',    'reason': 'REBALANCING'},

    {'symbol': 'CADBURY',     'slug': 'cadbury-nigeria', #Cadbury Nigeria Stock Price History
     'sector': 'Consumer',    'name': 'Cadbury Nigeria Plc',
     'exit': '2021-09-30',    'reason': 'REBALANCING'},

    {'symbol': 'GSK',         'slug': 'glaxosmithkline-consumer', #GSK plc DRC Stock Price History
     'sector': 'Consumer',    'name': 'GlaxoSmithKline Consumer Nig. Plc',
     'exit': '2018-09-30',    'reason': 'REBALANCING'},

    {'symbol': 'HONYFLOUR',   'slug': 'honeywell-flour-mills', #Honeywell Flour Mills Plc Stock Price History
     'sector': 'Consumer',    'name': 'Honeywell Flour Mills Plc',
     'exit': '2015-06-30',    'reason': 'REBALANCING'},

    # ── Merger and acquisition exits (include with care) ─────────
    {'symbol': 'UBN',         'slug': 'union-bank-of-nigeria',
     'sector': 'Financial',   'name': 'Union Bank of Nigeria Plc',
     'exit': '2023-03-31',    'reason': 'DELISTED'},  # Acquired by Titan Trust

    {'symbol': 'DIAMONB',     'slug': 'diamond-bank',
     'sector': 'Financial',   'name': 'Diamond Bank Plc',
     'exit': '2019-04-01',    'reason': 'MERGED'},    # Merged into Access Bank

    {'symbol': 'MOBIL',       'slug': '11-plc',
     'sector': 'Oil&Gas',     'name': '11 Plc (formerly Mobil Oil Nigeria)',
     'exit': '2021-09-30',    'reason': 'DELISTED'},  # Voluntary delisting
]


# ── 1C. INDEX MEMBERSHIP — point-in-time entry and exit dates ────
# Every stock that appeared in the NGX-30 at any point in the
# 2012-2025 study window is listed here with the date it entered
# and the date it exited (or '2025-12-31' if still current).
# This table drives the survivorship-bias-corrected backtest.

INDEX_MEMBERSHIP = [
    # symbol           entry         exit          reason
    # ── Current constituents ──────────────────────────────────────
    ('ZENITHBANK',  '2012-01-01', '2025-12-31', 'CURRENT'),
    ('GTCO',        '2012-01-01', '2025-12-31', 'CURRENT'),
    ('ACCESSCORP',  '2012-01-01', '2025-12-31', 'CURRENT'),
    ('FBNH',        '2012-01-01', '2025-12-31', 'CURRENT'),
    ('UBA',         '2012-01-01', '2025-12-31', 'CURRENT'),
    ('STANBIC',     '2012-01-01', '2025-12-31', 'CURRENT'),
    ('FIDELITYBK',  '2013-01-01', '2025-12-31', 'CURRENT'),
    ('FCMB',        '2013-01-01', '2025-12-31', 'CURRENT'),
    ('ETI',         '2012-01-01', '2025-12-31', 'CURRENT'),
    ('WEMABANK',    '2025-04-01', '2025-12-31', 'CURRENT'),
    ('NESTLE',      '2012-01-01', '2025-12-31', 'CURRENT'),
    ('DANGSUGAR',   '2012-01-01', '2025-12-31', 'CURRENT'),
    ('NB',          '2012-01-01', '2025-12-31', 'CURRENT'),
    ('INTBREW',     '2012-01-01', '2025-12-31', 'CURRENT'),
    ('BUAFOODS',    '2022-01-01', '2025-12-31', 'CURRENT'),
    ('SEPLAT',      '2014-04-01', '2025-12-31', 'CURRENT'),
    ('OANDO',       '2012-01-01', '2025-12-31', 'CURRENT'),
    ('TOTAL',       '2012-01-01', '2025-12-31', 'CURRENT'),
    ('ARADEL',      '2024-04-01', '2025-12-31', 'CURRENT'),
    ('DANGCEM',     '2012-01-01', '2025-12-31', 'CURRENT'),
    ('BUACEMENT',   '2020-04-01', '2025-12-31', 'CURRENT'),
    ('WAPCO',       '2012-01-01', '2025-12-31', 'CURRENT'),
    ('GEREGU',      '2022-10-01', '2025-12-31', 'CURRENT'),
    ('PRESCO',      '2012-01-01', '2025-12-31', 'CURRENT'),
    ('MTNN',        '2019-07-01', '2025-12-31', 'CURRENT'),
    ('AIRTELAFRI',  '2019-07-01', '2025-12-31', 'CURRENT'),
    ('TRANSCORP',   '2012-01-01', '2025-12-31', 'CURRENT'),
    ('NASCON',      '2012-01-01', '2025-12-31', 'CURRENT'),
    ('OKOMUOIL',    '2012-01-01', '2025-12-31', 'CURRENT'),
    ('LIVESTOCK',   '2012-01-01', '2025-12-31', 'CURRENT'),
    # ── Former: rebalancing drops ─────────────────────────────────
    ('CONOIL',      '2012-01-01', '2025-03-31', 'REBALANCING'),
    ('JBERGER',     '2012-01-01', '2025-03-31', 'REBALANCING'),
    ('FLOURMILLS',  '2012-01-01', '2024-09-30', 'REBALANCING'),
    ('STERLINGNG',  '2012-01-01', '2024-09-30', 'REBALANCING'),
    ('UNILEVE',     '2012-01-01', '2023-06-30', 'REBALANCING'),
    ('PZ',          '2012-01-01', '2022-06-30', 'REBALANCING'),
    ('CADBURY',     '2012-01-01', '2021-09-30', 'REBALANCING'),
    ('MOBIL',       '2012-01-01', '2021-09-30', 'DELISTED'),
    ('GSK',         '2012-01-01', '2018-09-30', 'REBALANCING'),
    ('DIAMONB',     '2012-01-01', '2019-04-01', 'MERGED'),
    ('UBN',         '2012-01-01', '2023-03-31', 'DELISTED'),
    ('HONYFLOUR',   '2012-01-01', '2015-06-30', 'REBALANCING'),
]

# Convert to DataFrame for easy querying
MEMBERSHIP_DF = pd.DataFrame(
    INDEX_MEMBERSHIP,
    columns=['Symbol', 'Entry_Date', 'Exit_Date', 'Reason']
)
MEMBERSHIP_DF['Entry_Date'] = pd.to_datetime(MEMBERSHIP_DF['Entry_Date'])
MEMBERSHIP_DF['Exit_Date']  = pd.to_datetime(MEMBERSHIP_DF['Exit_Date'])


# ── 1D. COMBINED FULL UNIVERSE ────────────────────────────────────
FULL_UNIVERSE = CURRENT_NGX30 + FORMER_NGX30

# Lookup: symbol → metadata dict
UNIVERSE_MAP  = {s['symbol']: s for s in FULL_UNIVERSE}

# Backward-compatible alias so existing code that references NGX30 still works
NGX30     = CURRENT_NGX30
NGX30_MAP = {s['symbol']: s for s in CURRENT_NGX30}

print(f"Current NGX-30 constituents  : {len(CURRENT_NGX30)} stocks")
print(f"Former NGX-30 constituents   : {len(FORMER_NGX30)} stocks")
print(f"Full survivorship-free universe: {len(FULL_UNIVERSE)} stocks")
print(f"Index membership records     : {len(MEMBERSHIP_DF)} entries")
print()
print("Sector breakdown (full universe):")
all_sectors = {}
for s in FULL_UNIVERSE:
    all_sectors[s['sector']] = all_sectors.get(s['sector'], 0) + 1
for sector, count in sorted(all_sectors.items()):
    print(f"  {sector:<15} {count} stocks")


# ══════════════════════════════════════════════════════════════════
# 1E. POINT-IN-TIME UNIVERSE UTILITIES
#
#     These functions implement survivorship-bias-corrected
#     stock selection.  At each walk-forward rebalancing date,
#     get_universe_at() returns only the stocks that were actually
#     in the NGX-30 at that moment in history.
# ══════════════════════════════════════════════════════════════════

def get_universe_at(date, membership_df: pd.DataFrame = MEMBERSHIP_DF,
                    universe_map: dict = UNIVERSE_MAP) -> list:
    """
    Return the list of NGX-30 stock metadata dicts that were active
    on a given date.

    Parameters
    ----------
    date : str or pd.Timestamp
        The rebalancing or evaluation date.
    membership_df : pd.DataFrame
        The INDEX_MEMBERSHIP table.
    universe_map : dict
        Symbol-to-metadata lookup.

    Returns
    -------
    list of dict
        Each dict has keys: symbol, slug, sector, name.

    Example
    -------
    >>> universe_2016 = get_universe_at('2016-06-01')
    >>> [s['symbol'] for s in universe_2016]
    ['ZENITHBANK', 'GTCO', ..., 'DIAMONB', 'HONYFLOUR' excluded, ...]
    """
    date = pd.Timestamp(date)
    active = membership_df[
        (membership_df['Entry_Date'] <= date) &
        (membership_df['Exit_Date']  >= date)
    ]['Symbol'].tolist()
    return [universe_map[sym] for sym in active if sym in universe_map]


def summarise_universe_changes(membership_df: pd.DataFrame = MEMBERSHIP_DF):
    """
    Print a year-by-year summary of how many stocks were in the
    NGX-30 constituency across the study period.
    """
    print("\nPoint-in-Time Universe Size by Year")
    print("=" * 45)
    for yr in range(2012, 2026):
        date      = pd.Timestamp(f'{yr}-06-30')
        universe  = get_universe_at(date, membership_df)
        exits_yr  = membership_df[
            membership_df['Exit_Date'].dt.year == yr]
        entries_yr = membership_df[
            membership_df['Entry_Date'].dt.year == yr]
        print(f"  {yr}: {len(universe):2d} active stocks | "
              f"+{len(entries_yr):2d} entries | "
              f"-{len(exits_yr):2d} exits")


def save_membership_csv(out_path: Path = PROCESSED / 'index_membership.csv',
                        membership_df: pd.DataFrame = MEMBERSHIP_DF):
    """
    Save the index membership table to CSV for use in the
    walk-forward validation loop and for dissertation documentation.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    membership_df.to_csv(out_path, index=False)
    log.info(f"Membership table saved → {out_path}")
    return out_path


# ══════════════════════════════════════════════════════════════════
# 2. INVESTING.COM PRICE DOWNLOADER
# ══════════════════════════════════════════════════════════════════

class InvestingComDownloader:
    """
    Downloads OHLCV data from Investing.com for NGX equities.
    Handles date selection, download triggering, and file renaming.
    """

    BASE_URL = 'https://ng.investing.com/equities/{slug}-historical-data'

    def __init__(self, download_folder: Path = RAW_PRICES,
                 headless: bool = False, page_wait: int = 4):
        self.folder    = Path(download_folder)
        self.folder.mkdir(parents=True, exist_ok=True)
        self.wait      = page_wait

        opts = webdriver.ChromeOptions()
        opts.add_experimental_option('prefs', {
            'download.default_directory': str(self.folder.resolve()),
            'download.prompt_for_download': False,
            'download.directory_upgrade':   True,
            'safebrowsing.enabled':         True,
        })
        if headless:
            opts.add_argument('--headless=new')
            opts.add_argument('--no-sandbox')
            opts.add_argument('--disable-dev-shm-usage')
        opts.add_argument('--disable-blink-features=AutomationControlled')
        opts.add_experimental_option('excludeSwitches', ['enable-automation'])
        opts.add_experimental_option('useAutomationExtension', False)

        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=opts,
        )
        self.driver.set_window_size(1400, 900)
        self._wait = WebDriverWait(self.driver, 12)

    # ── Internal helpers ─────────────────────────────────────────

    def _safe_click(self, element):
        try:
            element.click()
        except ElementClickInterceptedException:
            self.driver.execute_script('arguments[0].click();', element)

    def _dismiss_overlays(self):
        """Close cookie banners / sign-in popups if present."""
        selectors = [
            "button#onetrust-accept-btn-handler",
            "button.acc-btn",
            "[data-test='close-button']",
            ".popupCloseIcon",
        ]
        for sel in selectors:
            try:
                btn = self.driver.find_element(By.CSS_SELECTOR, sel)
                self._safe_click(btn)
                time.sleep(0.8)
            except NoSuchElementException:
                pass

    def _set_date_range(self, start: str, end: str):
        """
        Open the date-picker on Investing.com and set the custom range.
        start / end in MM/DD/YYYY format.
        """
        # Click the date range button
        btn_selectors = [
            "[data-test='date-range-button']",
            ".datePickerContainer",
            "#widgetFieldDateRange",
        ]
        clicked = False
        for sel in btn_selectors:
            try:
                btn = self._wait.until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, sel)))
                self._safe_click(btn)
                clicked = True
                time.sleep(1)
                break
            except TimeoutException:
                pass
        if not clicked:
            log.warning('Could not open date picker; using default range.')
            return False

        # Fill start date
        start_selectors = [
            "[data-test='date-range-start']",
            "#startDate",
            "input.inputDate:nth-of-type(1)",
        ]
        for sel in start_selectors:
            try:
                inp = self.driver.find_element(By.CSS_SELECTOR, sel)
                inp.clear()
                inp.send_keys(start)
                break
            except NoSuchElementException:
                pass

        # Fill end date
        end_selectors = [
            "[data-test='date-range-end']",
            "#endDate",
            "input.inputDate:nth-of-type(2)",
        ]
        for sel in end_selectors:
            try:
                inp = self.driver.find_element(By.CSS_SELECTOR, sel)
                inp.clear()
                inp.send_keys(end)
                break
            except NoSuchElementException:
                pass

        # Apply
        apply_selectors = [
            "[data-test='date-range-apply']",
            "button.applyBtn",
            "#applyBtn",
        ]
        for sel in apply_selectors:
            try:
                btn = self.driver.find_element(By.CSS_SELECTOR, sel)
                self._safe_click(btn)
                time.sleep(2)
                return True
            except NoSuchElementException:
                pass

        log.warning('Could not apply date range.')
        return False

    def _trigger_download(self, symbol: str) -> bool:
        """Click the download/CSV button and wait for file to appear."""
        dl_selectors = [
            "[data-test='download-button']",
            "a.downloadLink",
            "#downloadData",
            "button.js-download-button",
        ]
        for sel in dl_selectors:
            try:
                btn = self._wait.until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, sel)))
                self._safe_click(btn)
                log.info(f'Download triggered for {symbol}')
                time.sleep(6)           # allow download to complete
                return True
            except TimeoutException:
                pass
        log.error(f'Download button not found for {symbol}')
        return False

    def _rename_latest(self, symbol: str):
        """Rename the most recently modified CSV in the download folder."""
        csvs = sorted(self.folder.glob('*.csv'),
                      key=lambda p: p.stat().st_mtime, reverse=True)
        if not csvs:
            log.warning(f'No CSV found for {symbol}')
            return
        dest = self.folder / f'{symbol}_raw.csv'
        if dest.exists():
            dest.unlink()
        csvs[0].rename(dest)
        log.info(f'Saved → {dest.name}')

    # ── Public API ───────────────────────────────────────────────

    def download_stock(self, symbol: str, slug: str,
                       start: str = START_DATE,
                       end:   str = END_DATE) -> bool:
        url = self.BASE_URL.format(slug=slug)
        log.info(f'[{symbol}] Loading {url}')
        try:
            self.driver.get(url)
            time.sleep(self.wait)
            self._dismiss_overlays()
            self._set_date_range(start, end)
            ok = self._trigger_download(symbol)
            if ok:
                self._rename_latest(symbol)
            return ok
        except Exception as exc:
            log.error(f'[{symbol}] Error: {exc}')
            return False

    def download_universe(self, stocks: list = None,
                          start: str = START_DATE,
                          end:   str = END_DATE,
                          pause: int = 5,
                          skip_existing: bool = True) -> dict:
        """
        Download OHLCV data for a list of stocks from Investing.com.

        Parameters
        ----------
        stocks : list
            List of stock dicts (default: FULL_UNIVERSE — all 42 stocks,
            current + former).  Pass CURRENT_NGX30 to download only the
            live constituents.
        start, end : str
            Date range in MM/DD/YYYY format.
        pause : int
            Seconds to wait between downloads (be respectful to the server).
        skip_existing : bool
            If True, skip stocks whose raw CSV already exists in the
            download folder.  Useful for resuming an interrupted run.
        """
        if stocks is None:
            stocks = FULL_UNIVERSE

        results = {}
        total   = len(stocks)

        for i, stock in enumerate(stocks, 1):
            sym      = stock['symbol']
            out_file = self.folder / f'{sym}_raw.csv'

            if skip_existing and out_file.exists():
                print(f'[{i:02d}/{total}] {sym} — SKIPPED (file exists)')
                results[sym] = 'SKIPPED'
                continue

            # For former constituents that exited before END_DATE,
            # cap the download end date to their exit date
            eff_end = end
            mem_row = MEMBERSHIP_DF[MEMBERSHIP_DF['Symbol'] == sym]
            if not mem_row.empty:
                exit_dt = mem_row.iloc[0]['Exit_Date']
                if exit_dt < pd.Timestamp(END_DATE.replace('/', '-')
                                          .split('-')[2] + '-'
                                          + END_DATE.split('/')[1] + '-'
                                          + END_DATE.split('/')[0]):
                    eff_end = exit_dt.strftime('%m/%d/%Y')

            print(f'\n[{i:02d}/{total}] {sym} — {stock["name"]} '
                  f'({stock.get("reason", "CURRENT")})')
            ok = self.download_stock(sym, stock['slug'], start, eff_end)
            results[sym] = 'OK' if ok else 'FAILED'
            if i < total:
                time.sleep(pause)

        ok_n    = sum(1 for v in results.values() if v == 'OK')
        skipped = sum(1 for v in results.values() if v == 'SKIPPED')
        fail    = [k for k, v in results.items() if v == 'FAILED']
        print(f'\n{"="*55}')
        print(f'DOWNLOAD COMPLETE: {ok_n} OK | {skipped} skipped | '
              f'{len(fail)} failed')
        if fail:
            print(f'FAILED: {fail}')
            print('Tip: re-run download_stock() individually for each.')
        print(f'Files in: {self.folder}')
        return results

    def close(self):
        self.driver.quit()
        log.info('Browser closed.')


# ══════════════════════════════════════════════════════════════════
# 3. PRICE DATA CLEANING
#    Handles Investing.com CSV format, bonus-issue flags,
#    volume parsing and winsorisation
# ══════════════════════════════════════════════════════════════════

def parse_volume(val) -> float:
    """Convert Investing.com volume strings ('1.23M', '456K') to float."""
    if pd.isna(val) or str(val).strip() in ('-', ''):
        return 0.0
    s = str(val).replace(',', '').strip()
    mult = {'K': 1e3, 'M': 1e6, 'B': 1e9}
    for suffix, factor in mult.items():
        if s.upper().endswith(suffix):
            return float(s[:-1]) * factor
    try:
        return float(s)
    except ValueError:
        return 0.0


def clean_investing_csv(filepath: Path, symbol: str,
                        winsor_pct: float = 0.15) -> pd.DataFrame | None:
    """
    Clean an Investing.com OHLCV CSV:
      - Standardise column names
      - Parse dates and volume
      - Compute log-returns
      - Flag likely bonus-issue days (|return| > 20%)
      - Winsorise at ±winsor_pct
    """
    try:
        df = pd.read_csv(filepath)
    except Exception as exc:
        log.error(f'Cannot read {filepath}: {exc}')
        return None

    # Rename columns
    col_map = {
        'Date': 'Date', 'Price': 'Close', 'Open': 'Open',
        'High': 'High', 'Low': 'Low', 'Vol.': 'Volume',
        'Change %': 'Change_pct',
    }
    df = df.rename(columns={c: col_map[c]
                             for c in df.columns if c in col_map})

    # Parse date
    for fmt in ('%m/%d/%Y', '%b %d, %Y', '%Y-%m-%d'):
        try:
            df['Date'] = pd.to_datetime(df['Date'], format=fmt)
            break
        except (ValueError, TypeError):
            pass

    df = df.dropna(subset=['Date']).sort_values('Date').reset_index(drop=True)
    df['Symbol'] = symbol

    # Numeric close
    df['Close'] = pd.to_numeric(
        df['Close'].astype(str).str.replace(',', ''), errors='coerce')
    df['Volume'] = df['Volume'].apply(parse_volume)

    # Log returns
    df['LogReturn'] = np.log(df['Close'] / df['Close'].shift(1))

    # Flag bonus-issue candidates (single-day drop > 20%)
    df['BonusFlag'] = df['LogReturn'] < -0.20

    # Winsorise
    df['LogReturn_w'] = df['LogReturn'].clip(-winsor_pct, winsor_pct)

    # Keep core columns
    keep = ['Date', 'Symbol', 'Open', 'High', 'Low', 'Close',
            'Volume', 'LogReturn', 'LogReturn_w', 'BonusFlag']
    df = df[[c for c in keep if c in df.columns]]

    log.info(f'{symbol}: {len(df)} rows | '
             f'{df["Date"].min().date()} → {df["Date"].max().date()} | '
             f'Bonus flags: {df["BonusFlag"].sum()}')
    return df


def build_price_panel(raw_folder: Path = RAW_PRICES,
                      out_folder: Path = PROCESSED) -> pd.DataFrame:
    """
    Load all cleaned stock CSVs and assemble a wide-format
    closing price panel and a log-return matrix.
    """
    frames = []
    for fp in sorted(raw_folder.glob('*_raw.csv')):
        sym = fp.stem.replace('_raw', '')
        df  = clean_investing_csv(fp, sym)
        if df is not None:
            frames.append(df)

    if not frames:
        log.error('No cleaned data found. Run downloader first.')
        return pd.DataFrame()

    panel       = pd.concat(frames, ignore_index=True)
    bdate_idx   = pd.bdate_range(FRED_START, FRED_END)

    # Wide close prices
    prices_wide = (panel.pivot(index='Date', columns='Symbol', values='Close')
                   .reindex(bdate_idx))
    prices_wide.index.name = 'Date'

    # Wide log-returns (winsorised)
    returns_wide = (panel.pivot(index='Date', columns='Symbol',
                                values='LogReturn_w')
                    .reindex(bdate_idx))
    returns_wide.index.name = 'Date'

    prices_wide.to_csv(out_folder / 'ngx_prices_wide.csv')
    returns_wide.to_csv(out_folder / 'ngx_returns_wide.csv')
    log.info(f'Price panel  : {prices_wide.shape}  → {out_folder}/ngx_prices_wide.csv')
    log.info(f'Return panel : {returns_wide.shape} → {out_folder}/ngx_returns_wide.csv')
    return returns_wide


def build_pit_panel(returns_wide: pd.DataFrame = None,
                    membership_df: pd.DataFrame = MEMBERSHIP_DF,
                    out_folder: Path = PROCESSED) -> dict:
    """
    Build the survivorship-bias-corrected, point-in-time (PIT)
    return panel used in the GAT training and walk-forward loops.

    For each business date, only the stocks that were in the NGX-30
    on that date are marked as 'active'.  Returns that fall outside
    a stock's active window are replaced with NaN so the model does
    not inadvertently learn from future index composition.

    Returns
    -------
    dict with keys:
      'returns_pit'  — pd.DataFrame, returns with out-of-membership
                       dates set to NaN
      'active_mask'  — pd.DataFrame (bool), True where stock was active
      'membership'   — pd.DataFrame, the membership table
    """
    if returns_wide is None:
        fp = Path(out_folder) / 'ngx_returns_wide.csv'
        if not fp.exists():
            log.error(f'Returns file not found: {fp}. Run build_price_panel first.')
            return {}
        returns_wide = pd.read_csv(fp, index_col=0, parse_dates=True)

    bdate_idx    = returns_wide.index
    active_mask  = pd.DataFrame(False, index=bdate_idx,
                                columns=returns_wide.columns)

    for sym in returns_wide.columns:
        rows = membership_df[membership_df['Symbol'] == sym]
        if rows.empty:
            log.warning(f'{sym} not found in membership table; '
                        f'treating as always inactive.')
            continue
        for _, row in rows.iterrows():
            mask = ((bdate_idx >= row['Entry_Date']) &
                    (bdate_idx <= row['Exit_Date']))
            active_mask.loc[mask, sym] = True

    # Apply mask: replace returns with NaN when stock was not in the index
    returns_pit = returns_wide.where(active_mask)

    # Save outputs
    out_folder = Path(out_folder)
    returns_pit.to_csv(out_folder / 'ngx_returns_pit.csv')
    active_mask.to_csv(out_folder / 'ngx_active_mask.csv')
    save_membership_csv(out_folder / 'index_membership.csv')

    log.info(f'PIT return panel : {returns_pit.shape}  '
             f'→ ngx_returns_pit.csv')
    log.info(f'Active mask      : {active_mask.shape}  '
             f'→ ngx_active_mask.csv')

    # Quick sanity check
    mean_active = active_mask.sum(axis=1).mean()
    log.info(f'Average active stocks per day: {mean_active:.1f}')

    print(f'\n{"="*55}')
    print('POINT-IN-TIME PANEL SUMMARY')
    print(f'{"="*55}')
    print(f'  Total stocks in panel : {returns_pit.shape[1]}')
    print(f'  Trading days          : {returns_pit.shape[0]}')
    print(f'  Mean active per day   : {mean_active:.1f}')
    print(f'  NaN pct (out-of-index): '
          f'{returns_pit.isna().mean().mean()*100:.1f}%')
    summarise_universe_changes(membership_df)

    return {
        'returns_pit':  returns_pit,
        'active_mask':  active_mask,
        'membership':   membership_df,
    }


# ══════════════════════════════════════════════════════════════════
# 4. MACROECONOMIC DATA
#    Sources: FRED (free API), World Bank (free API),
#             CBN (manual download fallback with documented values)
# ══════════════════════════════════════════════════════════════════

FRED_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id='
WB_BASE   = 'https://api.worldbank.org/v2/country/NG/indicator/'

def _get_fred(series_id: str, col_name: str,
              start: str = FRED_START, end: str = FRED_END) -> pd.Series:
    """Download a FRED series and return as a named Series."""
    url = f'{FRED_BASE}{series_id}'
    try:
        df = pd.read_csv(url, parse_dates=['DATE'], index_col='DATE')
        df.columns = [col_name]
        df = df.loc[start:end].replace('.', np.nan).astype(float)
        log.info(f'FRED {series_id}: {len(df)} records')
        return df[col_name]
    except Exception as exc:
        log.error(f'FRED {series_id} failed: {exc}')
        return pd.Series(dtype=float, name=col_name)


def _get_world_bank(indicator: str, col_name: str,
                    start_yr: int = 2012, end_yr: int = 2025) -> pd.Series:
    """Fetch an annual World Bank indicator for Nigeria."""
    url = (f'{WB_BASE}{indicator}?format=json'
           f'&date={start_yr}:{end_yr}&per_page=50&country=NG')
    try:
        data = requests.get(url, timeout=20).json()[1]
        rows = [{'Year': int(d['date']), 'Value': d['value']}
                for d in data if d['value'] is not None]
        df = (pd.DataFrame(rows).sort_values('Year')
              .assign(Date=lambda x: pd.to_datetime(
                  x['Year'].astype(str) + '-01-01'))
              .set_index('Date')[['Value']]
              .rename(columns={'Value': col_name}))
        log.info(f'World Bank {indicator}: {len(df)} annual obs')
        return df[col_name]
    except Exception as exc:
        log.error(f'World Bank {indicator} failed: {exc}')
        return pd.Series(dtype=float, name=col_name)


# CBN MPR — all decisions from 2012-01-01 to 2025-12-31
# Source: https://www.cbn.gov.ng/MonetaryPolicy/decisions.html
CBN_MPR_DECISIONS = [
    ('2012-01-01', 12.00), ('2012-01-24', 12.00),
    ('2012-07-24', 12.00), ('2013-01-22', 12.00),
    ('2014-01-21', 12.00), ('2014-11-25', 13.00),
    ('2015-01-01', 13.00), ('2015-07-23', 13.00),
    ('2016-03-22', 12.00), ('2016-07-26', 14.00),
    ('2017-01-24', 14.00), ('2018-01-23', 14.00),
    ('2019-03-26', 13.50), ('2020-05-28', 12.50),
    ('2020-09-22', 11.50), ('2021-01-26', 11.50),
    ('2022-05-24', 13.00), ('2022-07-19', 14.00),
    ('2022-09-27', 15.50), ('2022-11-22', 16.50),
    ('2023-01-24', 17.50), ('2023-03-21', 18.00),
    ('2023-05-23', 18.50), ('2023-07-25', 18.75),
    ('2024-02-27', 22.75), ('2024-03-26', 24.75),
    ('2024-05-21', 26.25), ('2024-07-23', 26.75),
    ('2024-09-24', 27.25), ('2024-11-26', 27.50),
    ('2025-02-19', 27.50),
]


def download_macro_data(out_folder: Path = RAW_MACRO) -> pd.DataFrame:
    """
    Download all macroeconomic variables and save to CSV files.
    Returns a single merged daily DataFrame.
    """
    bdate_idx = pd.bdate_range(FRED_START, FRED_END)

    macro_series = {}

    # ── FRED series ──────────────────────────────────────────────
    fred_map = {
        'DCOILBRENTEU': 'Brent_USD',       # Brent crude spot (USD/bbl)
        'DTWEXBGS':     'USD_Index',        # Broad USD index
        'VIXCLS':       'VIX',             # CBOE VIX (global risk)
        'DFF':          'Fed_Funds_pct',   # US federal funds rate
        'DGS10':        'US_10Y_yield_pct',# US 10-year treasury yield
        'GOLDAMGBD228NLBM': 'Gold_USD',    # Gold price (USD/oz)
    }
    for series_id, col_name in fred_map.items():
        s = _get_fred(series_id, col_name)
        if not s.empty:
            s_daily = s.reindex(bdate_idx, method='ffill')
            macro_series[col_name] = s_daily
            s.to_csv(out_folder / f'{col_name}_fred.csv', header=True)

    # ── World Bank annual series (interpolated to daily) ──────────
    wb_map = {
        'FP.CPI.TOTL.ZG': 'NG_Inflation_pct',  # Nigeria annual CPI
        'NY.GDP.MKTP.KD.ZG': 'NG_GDP_growth',  # Nigeria real GDP growth
    }
    for indicator, col_name in wb_map.items():
        s = _get_world_bank(indicator, col_name)
        if not s.empty:
            s_daily = (s.reindex(s.index.union(bdate_idx))
                       .interpolate(method='time')
                       .reindex(bdate_idx))
            macro_series[col_name] = s_daily
            s.to_csv(out_folder / f'{col_name}_wb.csv', header=True)

    # ── CBN Monetary Policy Rate (forward-fill from decisions) ────
    mpr_df = pd.DataFrame(CBN_MPR_DECISIONS,
                           columns=['Date', 'MPR_pct'])
    mpr_df['Date'] = pd.to_datetime(mpr_df['Date'])
    mpr_daily = (mpr_df.set_index('Date')
                 .reindex(bdate_idx, method='ffill'))
    mpr_daily.index.name = 'Date'
    macro_series['CBN_MPR_pct'] = mpr_daily['MPR_pct']
    mpr_daily.to_csv(out_folder / 'CBN_MPR_pct.csv')
    log.info(f'CBN MPR: {len(mpr_daily)} trading days')

    # ── NGN/USD exchange rate ────────────────────────────────────
    # Primary: try FRED Nigeria official rate proxy
    ngn = _get_fred('NAEXKP01NGA661S', 'NGN_USD')
    if ngn.empty:
        # Fallback: documented CBN milestones (manually curated)
        log.warning('NGN/USD from FRED unavailable; using CBN milestones.')
        ngn_milestones = [
            ('2012-01-01', 158.0), ('2014-01-01', 162.0),
            ('2015-03-01', 197.0), ('2016-06-20', 282.0),
            ('2017-01-01', 305.0), ('2018-01-01', 306.0),
            ('2019-01-01', 306.5),('2020-01-01', 306.9),
            ('2020-04-01', 360.0), ('2021-01-01', 379.0),
            ('2022-01-01', 415.0), ('2023-01-01', 448.0),
            ('2023-06-14', 762.0), ('2024-01-01', 1480.0),
            ('2024-06-01', 1470.0),('2025-01-01', 1550.0),
        ]
        ngn_df = pd.DataFrame(ngn_milestones, columns=['Date', 'NGN_USD'])
        ngn_df['Date'] = pd.to_datetime(ngn_df['Date'])
        ngn = (ngn_df.set_index('Date')['NGN_USD']
               .reindex(bdate_idx, method='ffill'))
    else:
        ngn = ngn.reindex(bdate_idx, method='ffill')
    macro_series['NGN_USD'] = ngn
    pd.Series(ngn, name='NGN_USD').to_csv(out_folder / 'NGN_USD.csv',
                                           header=True)
    log.info('NGN/USD: built.')

    # ── Merge and save master macro file ─────────────────────────
    macro_df = pd.DataFrame(macro_series, index=bdate_idx)
    macro_df.index.name = 'Date'
    macro_df = macro_df.ffill().bfill()  # fill any remaining gaps
    out_path = out_folder / 'macro_daily_master.csv'
    macro_df.to_csv(out_path)
    log.info(f'Macro master: {macro_df.shape} → {out_path}')

    print(f'\n{"="*55}')
    print(f'MACRO DATA SUMMARY ({FRED_START} to {FRED_END})')
    print(f'{"="*55}')
    print(macro_df.describe().round(2).to_string())
    return macro_df


# ══════════════════════════════════════════════════════════════════
# 5. SENTIMENT DATA — RQ3
#
#    Three-layer collection:
#      Layer A — Google News RSS (free, no API key, headlines)
#      Layer B — Nigerian financial news sites (BeautifulSoup)
#      Layer C — NLP scoring with VADER (fast, free, local)
#                with FinBERT as optional upgrade
#
#    Output: daily sentiment score per stock / per market
#    Coverage: as far back as Google News / site archives allow
#              (typically 6–24 months from current date)
#
#    NOTE: For historical sentiment pre-2023, the GDELT Project
#          (gdeltproject.org) has a free API that covers global
#          news back to 1979. Section 5.3 provides that route.
# ══════════════════════════════════════════════════════════════════

HEADERS = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                   'AppleWebKit/537.36 (KHTML, like Gecko) '
                   'Chrome/120.0.0.0 Safari/537.36'),
    'Accept-Language': 'en-US,en;q=0.9',
}

# Nigerian financial news sources for scraping
NEWS_SOURCES = [
    {'name': 'BusinessDay',
     'url':  'https://businessday.ng/category/financial-intelligence/',
     'article_selector': 'article.jeg_post',
     'headline_selector': 'h3.jeg_post_title a',
     'date_selector':     'div.jeg_meta_date'},
    {'name': 'Nairametrics',
     'url':  'https://nairametrics.com/category/stock-market-news/',
     'article_selector': 'article.post',
     'headline_selector': 'h2.entry-title a',
     'date_selector':     'time.entry-date'},
    {'name': 'Vanguard_Business',
     'url':  'https://www.vanguardngr.com/category/business/',
     'article_selector': 'article',
     'headline_selector': 'h2.entry-title a',
     'date_selector':     'time.entry-date'},
    {'name': 'ThePunch_Business',
     'url':  'https://punchng.com/business/',
     'article_selector': 'article.post',
     'headline_selector': 'h2.post-title a',
     'date_selector':     'time.entry-date'},
]


class SentimentCollector:
    """
    Collects NGX-relevant news headlines and scores them
    with VADER for market sentiment analysis (RQ3).
    """

    def __init__(self, out_folder: Path = RAW_SENT):
        self.folder = Path(out_folder)
        self.folder.mkdir(parents=True, exist_ok=True)
        self.vader  = SentimentIntensityAnalyzer()

    # ── Layer A: Google News RSS ─────────────────────────────────

    def _google_news_rss(self, query: str, max_items: int = 50) -> list:
        """Fetch headlines via Google News RSS (no API key needed)."""
        q   = requests.utils.quote(query)
        url = (f'https://news.google.com/rss/search?q={q}'
               f'&hl=en-NG&gl=NG&ceid=NG:en')
        feed    = feedparser.parse(url)
        entries = []
        for entry in feed.entries[:max_items]:
            entries.append({
                'title':  entry.get('title', ''),
                'source': entry.get('source', {}).get('title', 'Google News'),
                'date':   entry.get('published', ''),
                'link':   entry.get('link', ''),
                'query':  query,
            })
        return entries

    def collect_google_news(self, stocks: list = NGX30,
                            extra_queries: list = None) -> pd.DataFrame:
        """
        Collect headlines for each stock + market-level queries
        via Google News RSS.
        """
        queries = []

        # Per-stock queries
        for s in stocks:
            queries.append(f'{s["symbol"]} NGX Nigeria stock')
            queries.append(f'{s["name"]} Nigeria earnings dividend')

        # Market-level queries (for overall NGX sentiment)
        market_queries = [
            'Nigerian Stock Exchange NGX market',
            'NGX All Share Index ASI Nigeria',
            'Nigeria economy Naira CBN monetary policy',
            'Nigeria oil price Brent NNPC revenue',
            'Nigeria inflation CPI NBS statistics',
            'Nigeria GDP growth economic outlook IMF',
            'NGX equities portfolio investment Nigeria',
        ]
        queries += (extra_queries or []) + market_queries

        all_entries = []
        total = len(queries)
        for i, q in enumerate(queries, 1):
            entries = self._google_news_rss(q)
            all_entries.extend(entries)
            if i % 10 == 0:
                print(f'  Google News RSS: {i}/{total} queries done '
                      f'({len(all_entries)} headlines so far)')
            time.sleep(1.2)     # respectful rate limiting

        df = pd.DataFrame(all_entries).drop_duplicates(subset=['title'])
        df['date_parsed'] = pd.to_datetime(df['date'], errors='coerce',
                                            utc=True)
        df['date_parsed'] = df['date_parsed'].dt.tz_localize(None)
        df = df.dropna(subset=['date_parsed'])
        out = self.folder / 'google_news_headlines.csv'
        df.to_csv(out, index=False)
        log.info(f'Google News: {len(df)} unique headlines → {out.name}')
        return df

    # ── Layer B: Nigerian site scraping ─────────────────────────

    def _scrape_site(self, source: dict,
                     pages: int = 3) -> list:
        """Scrape article headlines from a Nigerian news site."""
        articles = []
        for page in range(1, pages + 1):
            url = source['url'] + (f'page/{page}/' if page > 1 else '')
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                soup = BeautifulSoup(resp.text, 'html.parser')
                for art in soup.select(source['article_selector']):
                    try:
                        hl = art.select_one(source['headline_selector'])
                        dt = art.select_one(source['date_selector'])
                        if hl:
                            articles.append({
                                'title':  hl.get_text(strip=True),
                                'source': source['name'],
                                'date':   dt.get_text(strip=True) if dt else '',
                                'link':   hl.get('href', ''),
                            })
                    except Exception:
                        pass
                time.sleep(2)
            except Exception as exc:
                log.warning(f'{source["name"]} page {page}: {exc}')
        log.info(f'{source["name"]}: {len(articles)} articles scraped')
        return articles

    def scrape_nigerian_news(self, pages_per_source: int = 5) -> pd.DataFrame:
        """Scrape all configured Nigerian financial news sources."""
        all_articles = []
        for source in NEWS_SOURCES:
            arts = self._scrape_site(source, pages=pages_per_source)
            all_articles.extend(arts)

        df = pd.DataFrame(all_articles).drop_duplicates(subset=['title'])
        out = self.folder / 'nigerian_news_scraped.csv'
        df.to_csv(out, index=False)
        log.info(f'Nigerian news: {len(df)} headlines → {out.name}')
        return df

    # ── Layer C: GDELT historical sentiment (free, 2012 onward) ──

    def collect_gdelt_sentiment(self, keyword: str = 'Nigerian Stock Exchange',
                                start: str = '20120101',
                                end:   str = '20251231') -> pd.DataFrame:
        """
        Query GDELT Global Knowledge Graph API for daily article counts
        and average sentiment (tone) for a keyword.

        GDELT is free, requires no API key, and covers 2012 to present.
        Tone: negative = negative sentiment; positive = positive sentiment.
        """
        base = 'https://api.gdeltproject.org/api/v2/doc/doc'
        frames = []

        # GDELT works best in monthly chunks
        start_dt = datetime.strptime(start, '%Y%m%d')
        end_dt   = datetime.strptime(end,   '%Y%m%d')
        current  = start_dt

        print(f'Collecting GDELT sentiment for: "{keyword}"')
        while current < end_dt:
            chunk_end = min(current + timedelta(days=30), end_dt)
            params = {
                'query':     keyword,
                'mode':      'ArtList',
                'startdatetime': current.strftime('%Y%m%d%H%M%S'),
                'enddatetime':   chunk_end.strftime('%Y%m%d%H%M%S'),
                'maxrecords': 250,
                'format':    'json',
                'sort':      'DateDesc',
            }
            try:
                resp = requests.get(base, params=params,
                                    headers=HEADERS, timeout=30)
                data = resp.json()
                articles = data.get('articles', [])
                for art in articles:
                    frames.append({
                        'date':  art.get('seendate', '')[:8],
                        'title': art.get('title', ''),
                        'tone':  float(art.get('tone', 0)),
                        'url':   art.get('url', ''),
                        'source': art.get('domain', ''),
                    })
                print(f'  {current.strftime("%Y-%m")}: '
                      f'{len(articles)} articles')
            except Exception as exc:
                log.warning(f'GDELT chunk {current.strftime("%Y-%m")}: {exc}')
            current = chunk_end + timedelta(days=1)
            time.sleep(1.5)

        if not frames:
            return pd.DataFrame()

        df = pd.DataFrame(frames)
        df['date'] = pd.to_datetime(df['date'], format='%Y%m%d',
                                     errors='coerce')
        df = df.dropna(subset=['date'])
        out = self.folder / 'gdelt_ngx_sentiment.csv'
        df.to_csv(out, index=False)
        log.info(f'GDELT: {len(df)} articles → {out.name}')
        return df

    # ── NLP Scoring ─────────────────────────────────────────────

    def score_headlines(self, df: pd.DataFrame,
                        text_col: str = 'title') -> pd.DataFrame:
        """
        Apply VADER sentiment scoring to a DataFrame of headlines.

        VADER compound score: -1 (most negative) to +1 (most positive).
        Scores are then aggregated to daily values.
        """
        scored = df.copy()
        scores = scored[text_col].fillna('').apply(
            lambda t: self.vader.polarity_scores(t)
        )
        scored['vader_compound'] = scores.apply(lambda s: s['compound'])
        scored['vader_pos']      = scores.apply(lambda s: s['pos'])
        scored['vader_neg']      = scores.apply(lambda s: s['neg'])
        scored['vader_neu']      = scores.apply(lambda s: s['neu'])
        return scored

    @staticmethod
    def aggregate_to_daily(scored_df: pd.DataFrame,
                           date_col: str = 'date_parsed') -> pd.DataFrame:
        """
        Aggregate scored headlines to daily sentiment features.

        Features produced:
          - sent_mean      : mean compound score (signal direction)
          - sent_std       : standard deviation (uncertainty proxy)
          - sent_pos_ratio : proportion of positive headlines
          - sent_neg_ratio : proportion of negative headlines
          - article_count  : number of articles on that day
        """
        if date_col not in scored_df.columns:
            scored_df[date_col] = pd.to_datetime(
                scored_df['date'], errors='coerce')
        df = scored_df.dropna(subset=[date_col]).copy()
        df['date_only'] = df[date_col].dt.normalize()
        agg = df.groupby('date_only').agg(
            sent_mean      = ('vader_compound', 'mean'),
            sent_std       = ('vader_compound', 'std'),
            sent_pos_ratio = ('vader_pos',      'mean'),
            sent_neg_ratio = ('vader_neg',      'mean'),
            article_count  = ('vader_compound', 'count'),
        ).rename_axis('Date')
        return agg

    def build_sentiment_panel(self, gdelt_df: pd.DataFrame = None,
                              google_df: pd.DataFrame = None,
                              news_df:   pd.DataFrame = None,
                              out_folder: Path = PROCESSED) -> pd.DataFrame:
        """
        Merge all sentiment sources, score them, aggregate to daily
        frequency, and align to the business date index.
        """
        parts = []
        if gdelt_df is not None and not gdelt_df.empty:
            gdelt_scored = self.score_headlines(gdelt_df, text_col='title')
            gdelt_scored['date_parsed'] = pd.to_datetime(
                gdelt_df['date'], errors='coerce')
            parts.append(gdelt_scored)

        if google_df is not None and not google_df.empty:
            google_scored = self.score_headlines(google_df, text_col='title')
            parts.append(google_scored)

        if news_df is not None and not news_df.empty:
            news_scored = self.score_headlines(news_df, text_col='title')
            news_scored['date_parsed'] = pd.to_datetime(
                news_df['date'], errors='coerce')
            parts.append(news_scored)

        if not parts:
            log.error('No sentiment data to aggregate.')
            return pd.DataFrame()

        all_scored  = pd.concat(parts, ignore_index=True)
        daily_sent  = self.aggregate_to_daily(all_scored)

        # Align to business date index
        bdate_idx   = pd.bdate_range(FRED_START, FRED_END)
        daily_sent  = daily_sent.reindex(bdate_idx).ffill(limit=3)
        daily_sent.index.name = 'Date'

        out_path = Path(out_folder) / 'sentiment_daily.csv'
        daily_sent.to_csv(out_path)
        log.info(f'Sentiment panel: {daily_sent.shape} → {out_path}')

        print(f'\n{"="*55}')
        print(f'SENTIMENT PANEL SUMMARY')
        print(f'{"="*55}')
        print(daily_sent.describe().round(4).to_string())
        return daily_sent


# ══════════════════════════════════════════════════════════════════
# 6. OPTIONAL — FinBERT UPGRADE (better financial NLP)
#    Requires: pip install transformers torch
# ══════════════════════════════════════════════════════════════════

def score_with_finbert(texts: list) -> list:
    """
    Score a list of text strings with FinBERT.
    Returns a list of dicts: {'label': 'positive'/'negative'/'neutral',
                               'score': float}
    Install: pip install transformers torch
    """
    try:
        from transformers import pipeline
        finbert = pipeline('text-classification',
                           model='ProsusAI/finbert',
                           top_k=None)
        results = []
        for text in texts:
            out = finbert(text[:512])[0]     # FinBERT max 512 tokens
            top = max(out, key=lambda x: x['score'])
            # Normalise to -1 to +1 scale (compound-like)
            if top['label'] == 'positive':
                compound = top['score']
            elif top['label'] == 'negative':
                compound = -top['score']
            else:
                compound = 0.0
            results.append({'label': top['label'],
                            'score': top['score'],
                            'compound_finbert': compound})
        return results
    except ImportError:
        print('FinBERT requires: pip install transformers torch')
        print('Falling back to VADER scoring.')
        return []


# ══════════════════════════════════════════════════════════════════
# 7. MASTER PIPELINE — run all three in sequence
# ══════════════════════════════════════════════════════════════════

def run_full_pipeline(
    download_prices: bool = True,
    download_macro:  bool = True,
    download_sentiment: bool = True,
    headless: bool = False,
    stocks: list = None,          # defaults to FULL_UNIVERSE inside
):
    """
    End-to-end data collection for the NGX research project.

    Set flags to False to skip individual stages during
    incremental runs (e.g., re-run sentiment only).
    """
    if stocks is None:
        stocks = FULL_UNIVERSE

    print('╔══════════════════════════════════════════════════╗')
    print('║  NGX Research Data Pipeline                      ║')
    print(f'║  Period  : {START_DATE} to {END_DATE}           ║')
    print(f'║  Universe: {len(stocks)} stocks '
          f'({len(CURRENT_NGX30)} current + '
          f'{len(FORMER_NGX30)} former)  ║')
    print('╚══════════════════════════════════════════════════╝\n')

    # ── Stage 1: Prices ──────────────────────────────────────────
    if download_prices:
        print('\n── STAGE 1: PRICE DATA (Investing.com) ──────────')
        scraper = InvestingComDownloader(headless=headless)
        try:
            scraper.download_universe(stocks, skip_existing=True)
        finally:
            scraper.close()

        returns_df = build_price_panel()
        pit_data   = build_pit_panel(returns_df)
        print(f'Returns panel shape  : {returns_df.shape}')
        print(f'PIT returns shape    : {pit_data["returns_pit"].shape}')

    # ── Stage 2: Macro ───────────────────────────────────────────
    if download_macro:
        print('\n── STAGE 2: MACROECONOMIC DATA ───────────────────')
        macro_df = download_macro_data()
        print(f'Macro panel shape: {macro_df.shape}')

    # ── Stage 3: Sentiment ────────────────────────────────────────
    if download_sentiment:
        print('\n── STAGE 3: SENTIMENT DATA (RQ3) ─────────────────')
        collector = SentimentCollector()

        # 3a. GDELT (historical, 2012 onward)
        print('\n  [3a] GDELT historical sentiment...')
        gdelt_df = collector.collect_gdelt_sentiment(
            keyword='Nigerian Stock Exchange NGX Nigeria economy',
            start=FRED_START.replace('-', ''),
            end=FRED_END.replace('-', ''),
        )

        # 3b. Google News RSS (recent headlines)
        print('\n  [3b] Google News RSS headlines...')
        google_df = collector.collect_google_news(stocks)

        # 3c. Nigerian site scraping (current)
        print('\n  [3c] Nigerian financial news scraping...')
        news_df = collector.scrape_nigerian_news(pages_per_source=5)

        # 3d. Merge + score + aggregate to daily panel
        print('\n  [3d] Scoring and aggregating...')
        sent_df = collector.build_sentiment_panel(
            gdelt_df=gdelt_df,
            google_df=google_df,
            news_df=news_df,
        )

    print('\n╔══════════════════════════════════════════════╗')
    print('║  PIPELINE COMPLETE                           ║')
    print(f'║  All files saved under: {BASE_DIR}           ║')
    print('╚══════════════════════════════════════════════╝')


# ══════════════════════════════════════════════════════════════════
# 8. ENTRY POINT
# ══════════════════════════════════════════════════════════════════

if __name__ == '__main__':

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION A — Full pipeline (all 42 stocks + macro + sentiment)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # run_full_pipeline(headless=False)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION B — Download current NGX-30 only (30 stocks, faster)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # scraper = InvestingComDownloader(headless=False)
    # scraper.download_universe(CURRENT_NGX30, skip_existing=True)
    # scraper.close()
    # build_price_panel()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION C — Download former constituents only (for top-up)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # scraper = InvestingComDownloader(headless=False)
    # scraper.download_universe(FORMER_NGX30, skip_existing=True)
    # scraper.close()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION D — Build PIT panel from already-downloaded CSVs
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # returns_df = build_price_panel()
    # pit_data   = build_pit_panel(returns_df)
    # summarise_universe_changes()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION E — Macro only (no browser needed)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # download_macro_data()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION F — Sentiment only (RQ3)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # collector = SentimentCollector()
    # gdelt_df  = collector.collect_gdelt_sentiment()
    # google_df = collector.collect_google_news(FULL_UNIVERSE)
    # news_df   = collector.scrape_nigerian_news()
    # sent_df   = collector.build_sentiment_panel(gdelt_df, google_df, news_df)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION G — Single stock test (run this first to verify setup)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    scraper = InvestingComDownloader(headless=False)
    try:
        scraper.download_stock(
            symbol='ZENITHBANK',
            slug='zenith-bank',
            start=START_DATE,
            end=END_DATE,
        )
    finally:
        scraper.close()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OPTION H — Universe inspection (no download, no browser)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # print("\nFull universe (42 stocks):")
    # for s in FULL_UNIVERSE:
    #     tag = '(former)' if s in FORMER_NGX30 else '(current)'
    #     print(f"  {s['symbol']:<14} {s['sector']:<15} {tag}")
    # print()
    # summarise_universe_changes()
    # print()
    # print("Stocks active on 2016-06-01 (during oil crash):")
    # for s in get_universe_at('2016-06-01'):
    #     print(f"  {s['symbol']}")
    # print()
    # save_membership_csv()