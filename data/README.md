## Data Sources

### Nigerian Stock Exchange (NGX)
- **Source**: Investing.com, Official NGX portal
- **Period**: 2015-2025
- **Frequency**: Daily
- **Format**: CSV files with OHLCV data
- **Stocks**: Top 30-50 by market cap and liquidity

### Benchmark Data
- **S&P 500**: Yahoo Finance (^GSPC)
- **MSCI EM**: Yahoo Finance (EEM ETF)
- **JSE**: Johannesburg Stock Exchange

### Macroeconomic Data
- **Oil Prices**: Brent Crude from EIA
- **Exchange Rates**: NGN/USD from CBN
- **Interest Rates**: MPR from CBN
- **Inflation**: CPI from Nigerian Bureau of Statistics

## Data Access

**Note**: Raw data files are NOT included in the repository due to size and licensing.

To download data:
```bash
python scripts/download_ngx_data.py
```

## Data Quality

- All data undergoes quality checks (see `notebooks/02_data_cleaning.ipynb`)
- Missing values handled using forward-fill for prices
- Corporate actions adjusted for splits and dividends
- Outliers investigated and documented

## Data Privacy

- All data used for academic research only
- No proprietary or confidential data included
- Public market data only

## Contact

For data-related questions, contact nnamdi@datafiedtech.com