# Machine Learning-Enhanced Portfolio Optimisation for Emerging Markets

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

> **PhD Research Project**  
> A Two-Stage Approach for the Nigerian Stock Exchange

---

## 📋 Table of Contents

- [Overview](#overview)
- [Research Questions](#research-questions)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Methodology](#methodology)
- [Results](#results)
- [Publications](#publications)
- [Citation](#citation)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🎯 Overview

This repository contains the complete implementation of my PhD research on **Machine Learning-Enhanced Portfolio Optimisation for Emerging Markets**, with a specific focus on the Nigerian Stock Exchange (NGX).

### Research Context

Traditional portfolio optimisation methods (e.g., Markowitz Mean-Variance Optimisation) face significant challenges in emerging markets characterised by:
- High volatility
- Liquidity constraints
- Information asymmetry
- Infrastructure limitations
- Non-normal return distributions

This research develops a novel **hybrid deep learning framework** that combines:
1. **Graph Neural Networks (GNNs)** for stock pre-selection
2. **Reinforcement Learning (RL)** for dynamic portfolio allocation

### Why Nigerian Stock Exchange?

- Africa's second-largest stock market by market capitalisation
- Significantly under-researched in academic literature
- Unique market characteristics requiring specialised approaches
- Practical impact potential for Nigerian investors and fund managers

---

## 🔬 Research Questions

**Primary Research Question:**
> "How can hybrid deep learning frameworks enhance portfolio optimisation in emerging markets through two-stage stock pre-selection and asset allocation?"

**Sub-Research Questions:**

**RQ1: Model Development**
> "How do Graph Neural Networks (GNNs) combined with attention mechanisms improve stock pre-selection accuracy compared to traditional technical analysis methods in the Nigerian Stock Exchange?"

**RQ2: Portfolio Optimization**
> "What is the comparative performance of reinforcement learning-based portfolio optimisation versus traditional mean-variance optimisation in volatile emerging markets?"

**RQ3: Alternative Data Integration**
> "To what extent does incorporating sentiment analysis from financial news and social media improve portfolio performance beyond price-based features alone?"

**RQ4: Context-Specific Challenges**
> "What are the unique characteristics of Nigerian/West African stock markets (volatility patterns, liquidity constraints, infrastructure challenges) that require specialised portfolio optimisation approaches?"

---

## ✨ Key Features

### 🔹 Two-Stage Framework
- **Stage 1**: GNN-based stock pre-selection from the universe of NGX stocks
- **Stage 2**: RL-based dynamic portfolio weight optimization

### 🔹 Advanced Models
- **Graph Attention Networks (GAT)** for capturing inter-stock dependencies
- **Deep Q-Networks (DQN)** and **Proximal Policy Optimization (PPO)** for portfolio management
- Multi-objective RL with separate agents for returns, risk, and drawdown

### 🔹 Comprehensive Analysis
- Market microstructure characterisation
- Volatility clustering analysis (GARCH modelling)
- Liquidity constraints quantification
- Cross-market validation (NGX, JSE, NSE)

### 🔹 Explainable AI
- SHAP (SHapley Additive exPlanations) for feature importance
- LIME (Local Interpretable Model-agnostic Explanations) for individual predictions
- Attention weight visualisation for GNN interpretability

### 🔹 Real-World Considerations
- Transaction cost modelling (Nigerian market rates)
- Liquidity constraints handling
- Infrastructure adaptation for resource-constrained environments
- No short-selling constraints (aligned with NGX regulations)

---

## 🚀 Installation

### Prerequisites

- Python 3.8 or higher
- pip or conda package manager
- Git

### Clone the Repository
```bash
git clone https://github.com/[your-username]/ml-portfolio-optimization-ngx.git
cd ml-portfolio-optimization-ngx
```

### Install Dependencies

**Using pip:**
```bash
pip install -r requirements.txt
```

**Using conda:**
```bash
conda env create -f environment.yml
conda activate portfolio-ml
```

### Install Development Dependencies (Optional)
```bash
pip install -r requirements-dev.txt
```

---

## ⚡ Quick Start

### 1. Download Data
```bash
# Download Nigerian Stock Exchange data
python scripts/download_ngx_data.py --start-date 2015-01-01 --end-date 2025-12-31

# Download benchmark data (S&P 500, MSCI EM)
python scripts/download_ngx_data.py --benchmarks
```

### 2. Run Market Characterisation (RQ4)
```bash
# Comprehensive market analysis
python scripts/run_market_analysis.py --output results/market_analysis/
```

### 3. Train GNN Model (RQ1)
```bash
# Train Graph Attention Network for stock selection
python scripts/train_gnn_model.py --config configs/gnn_config.yaml
```

### 4. Train RL Agent (RQ2)
```bash
# Train PPO agent for portfolio optimization
python scripts/train_rl_agent.py --config configs/rl_config.yaml --algorithm ppo
```

### 5. Run Complete Backtesting
```bash
# Evaluate the full framework on the test period
python scripts/evaluate_framework.py --start-date 2022-01-01 --end-date 2024-12-31
```

### 6. Generate Results
```bash
# Generate all figures and tables for papers
python scripts/generate_results.py --output paper/figures/
```

---

## 📂 Project Structure
For detailed structure, see [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

---

## 🧪 Methodology

### Overview

Our methodology follows a structured six-phase approach:

1. **Data Collection & Market Characterization** (RQ4)
2. **Feature Engineering & Preprocessing**
3. **Stock Pre-Selection Model Development** (RQ1)
4. **Portfolio Optimization Model Development** (RQ2)
5. **Alternative Data Integration** (RQ3 - Conditional)
6. **Comprehensive Evaluation & Validation**

### Dataset

- **Primary**: Nigerian Stock Exchange (NGX)
  - Top 30-50 stocks by market capitalisation and liquidity
  - Daily OHLCV data: 2015-2025 (~2,500 trading days)
  - Corporate actions: dividends, splits, rights issues

- **Comparative**: 
  - Johannesburg Stock Exchange (JSE)
  - S&P 500 (developed market benchmark)
  - MSCI Emerging Markets Index

- **External Data**:
  - Macroeconomic indicators (oil prices, exchange rates, interest rates)
  - Financial news sentiment (conditional)

### Models

#### Graph Neural Network (Stock Pre-Selection)

- **Architecture**: Graph Attention Network (GAT)
- **Input**: Technical indicators + correlation-based graph structure
- **Output**: Stock rankings/return predictions
- **Baselines**: LSTM, Random Forest, XGBoost, Technical Analysis

#### Reinforcement Learning (Portfolio Optimisation)

- **Algorithms**: 
  - Deep Q-Network (DQN)
  - Proximal Policy Optimisation (PPO)
- **State Space**: Portfolio weights, market features, technical indicators
- **Action Space**: Continuous (portfolio weight adjustments)
- **Reward Functions**: Returns, Sharpe ratio, maximum drawdown
- **Baselines**: Markowitz MVO, Equal-Weight, Buy-and-Hold

### Evaluation Metrics

**Return Metrics:**
- Cumulative Return
- Annualised Return
- Alpha (vs NGX All-Share Index)

**Risk-Adjusted Metrics:**
- Sharpe Ratio
- Sortino Ratio
- Calmar Ratio
- Information Ratio

**Risk Metrics:**
- Maximum Drawdown
- Volatility
- Value at Risk (VaR)
- Conditional VaR (CVaR)

For detailed methodology, see [docs/methodology.md](docs/methodology.md)

---

## 📊 Results

### Preliminary Findings (RQ4 - Market Characterization)

**Status:** ✅ Complete (March 2026)

Key findings from Nigerian Stock Exchange analysis:

| Metric | NGX | S&P 500 | MSCI EM |
|--------|-----|---------|---------|
| Avg. Annual Return | TBD% | ~10% | ~8% |
| Annualized Volatility | TBD% | ~15% | ~20% |
| Sharpe Ratio | TBD | 0.65 | 0.40 |
| Avg. Correlation | TBD | 0.45 | 0.50 |
| Zero-Volume Days | TBD% | 0% | ~2% |

**Key Insights:**
- Non-normal return distributions (high kurtosis, negative skewness)
- Significant volatility clustering (GARCH persistence > 0.90)
- Liquidity constraints affect portfolio rebalancing frequency
- Market shows characteristics requiring specialised ML approaches

📄 **Full Report**: [results/reports/market_characterization_report.pdf](results/reports/market_characterization_report.pdf)

### Model Performance (RQ1 & RQ2)

**Status:** 🚧 In Progress

*(Results will be updated as experiments complete)*

---

## 📚 Publications

### Conference Papers

1. **IndabaX Nigeria 2026** (Submitted)
   - *"Characterising the Nigerian Stock Exchange: Implications for Machine Learning Portfolio Optimisation"*
   - Status: Under Review
   - [Abstract](paper/indabax_2026/abstract.pdf) | [Poster](paper/indabax_2026/poster.pdf)

2. **ICAIF 2026** (Planned)
   - *"A Two-Stage Deep Learning Framework for Portfolio Optimisation in Emerging Markets"*
   - Target Submission: June 2026

### Journal Papers (Planned)

1. **Applied Intelligence** or **Expert Systems with Applications**
   - *"Machine Learning-Enhanced Portfolio Optimisation for Resource-Constrained Markets: A Nigerian Case Study"*
   - Target Submission: Q4 2026

---

## 📖 Citation

If you use this code or findings in your research, please cite:
```bibtex
@phdthesis{nnamdi2027portfolio,
  title={Machine Learning-Enhanced Portfolio Optimisation for Emerging Markets: A Two-Stage Approach for the Nigerian Stock Exchange},
  author={Nnamdi A. Isichei},
  year={2027},
  school={Nasarawa State University, Keffi},
  type={PhD Thesis}
}

@inproceedings{yourname2026indabax,
  title={Characterising the Nigerian Stock Exchange: Implications for Machine Learning Portfolio Optimisation},
  author={Nnamdi A. Isichei and Professor H. K. Oduwole},
  booktitle={IndabaX Nigeria 2026},
  year={2026}
}
```

Or use the `CITATION.cff` file for automated citation generation.

---

## 🤝 Contributing

This is a PhD research project, but suggestions and discussions are welcome!

### Ways to Contribute:

1. **Report Issues**: Found a bug? [Open an issue](https://github.com/[your-username]/ml-portfolio-optimization-ngx/issues)
2. **Suggest Improvements**: Have ideas? Start a [discussion](https://github.com/[your-username]/ml-portfolio-optimization-ngx/discussions)
3. **Share Data**: Access to additional Nigerian market data? Contact me!
4. **Collaboration**: Interested in collaborating? Reach out!

### Development Guidelines:

- Follow PEP 8 style guide
- Write docstrings for all functions
- Add unit tests for new features
- Update documentation

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Data Usage Notice

- **Nigerian Stock Exchange data**: Used for academic research purposes only
- **No commercial use** or redistribution without proper licensing
- **Acknowledgement**: All publications acknowledge NSE as a data source

---

## 👤 Contact

**Nnamdi A. Isichei**
- 🎓 PhD Candidate, Data Science and Technology
- 🏛️ Centre for Cyberspace Studies, Nasarawa State University, Keffi
- 📧 Email: nnamdi@datafiedtech.com
- 💼 LinkedIn: [nnamdi-isichei](https://www.linkedin.com/in/nnamdi-isichei/)
- 🐦 X: [isichei_nnamdi](https://x.com/isichei_nnamdi)
- 🌐 Website: https://www.isicheinnamdi.com

**Supervisor:** H. K. Oduwole, Professor
- 📧 Email: oduwolekh@nsuk.edu.ng

---

## 🙏 Acknowledgments

- **Nigerian Stock Exchange Group** for providing market data
- **Nasarawa State University** for institutional support
- **Deep Learning Indaba** community for inspiration
- **Open-source community** for the amazing tools and libraries

---

## 📅 Project Timeline

- **Jan 2026**: Research commenced, data collection
- **Feb-Mar 2026**: Market characterization (RQ4)
- **Apr-Jun 2026**: GNN model development (RQ1)
- **Jul-Dec 2026**: RL model development (RQ2)
- **Jan-Apr 2027**: Comprehensive evaluation
- **May-Sep 2027**: Thesis writing
- **Oct-Dec 2027**: Defense and completion

---

## 🔖 Keywords

`machine learning` `portfolio optimisation` `emerging markets` `Nigerian stock exchange` `graph neural networks` `reinforcement learning` `deep learning` `financial AI` `quantitative finance` `African markets` `fintech`

---

## ⭐ Star History

If you find this research useful, please consider starring the repository!

[![Star History Chart](https://api.star-history.com/svg?repos=[isichei-nnamdi]/phd-research-portfolio-optimization&type=Date)](https://star-history.com/#[isichei-nnamdi]/phd-research-portfolio-optimization&Date)

---

<p align="center">
  <sub>Built with ❤️ for African Financial Markets</sub>
</p>

<p align="center">
  <sub>🇳🇬 Proudly researched in Nigeria 🇳🇬</sub>
</p>
