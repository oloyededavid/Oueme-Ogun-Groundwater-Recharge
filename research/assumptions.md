# Assumptions register

Every assumption the results depend on, why it was made, how much it matters, and what would test it.
Effects are on the mean 2018–2024 residual of the Upper Ouémé (mm per year) unless stated; they are
computed in `scripts/03_analysis.py` and shown in Table 4 of the web version. Ranges come from
alternative assumptions and are not confidence intervals.

| # | Assumption | Basis | Effect if wrong | What would test it |
|---|---|---|---|---|
| A1 | River flow in 2018–2024 is the 1988–2010 runoff ratio times each year's satellite rainfall | Only period-mean flows for 1971–2010 are published (Kodja et al., 2020); no 2018–2024 discharge was found | Largest single effect. Ratios of 0.24–0.27 close the balance; the single-year range of 0.14–0.28 in the Donga sub-basin moves the residual from about +171 to −50 mm | Measured discharge at Bétérou for 2018–2024 (AMMA-CATCH, DGEau Benin) |
| A2 | A runoff ratio from gauge rainfall can be applied to satellite rainfall | Published flows come with gauge rainfall (30 stations, Thiessen) | Small: recomputing the ratio from each product's own 1988–2010 rainfall changes the residual by −1 to +10 mm | Already tested (Section 4.3) |
| A3 | Storage change over seven years is small | Standard for multi-year balances | Tested, not assumed, in Section 4.4: storing the residual needs a rise of 57–592 m | AMMA-CATCH well records (`scripts/04_validate_wtf.py`) |
| A4 | Specific yield of the weathered profile is 0.2–1.5% | Lachassagne et al. (2021), as recorded in `research/literature_review.md`; the full-text value was not re-checked in version 0.3 because the publisher and HAL blocked automated access | Changes only the size of the storage diagnostic. A rise of 10 m would need 8–12%, far outside the range | Magnetic resonance soundings or pumping tests in the catchment (e.g. Vouillamoz et al., 2014) |
| A5 | Underground outflow across the catchment boundary is small | Shallow weathered aquifers; not measured | Unknown; would add to the residual's explanation | Head gradients at the catchment boundary |
| A6 | Abstraction is small | Kamagaté et al. (2007), Donga sub-basin | Unknown for the whole catchment | Borehole inventories |
| A7 | WaPOR v3 L1-AETI is unbiased | No evaluation of v3 in these catchments; v2 errors 29–31% across Africa (Blatchford et al., 2020) | ±10% changes the residual by about ±95 mm | Eddy-covariance data for 2018 onwards |
| A8 | The three rainfall products bracket rainfall | None: they share gauge inputs and, for the two CHIRPS versions, a method | Product choice moves the residual by about 47 mm; in the Upper Ouémé CHIRPS v2.0 and TAMSAT annual totals correlate at −0.26; the true uncertainty may be larger | Gauge records for 2018–2024 (AMMA-CATCH, Météo-Bénin) |
| A9 | One catchment area for every term | The analysed HydroBASINS polygon, 10,101.7 km² on the WGS84 ellipsoid | Using 10,070–10,143 km² instead changes the residual by less than 1 mm | — |
| A10 | Pixels whose centre lies inside the polygon represent the catchment | Standard practice at 0.05° | Not quantified; edge cells are a small share of 333 (Ouémé) and 313 (Ogun) cells | Fractional-area weighting |
| A11 | 2018–2024 describes the catchments' behaviour | Set by the WaPOR v3 record, which starts in 2018 | The period was 4.0% (Ouémé) and 8.2% (Ogun) wetter than 1991–2020, with no dry year in the Ouémé; results do not describe droughts or long-term means | A longer ET record |
| A12 | The Upper Ogun has the same weathered-basement hydrogeology | Regional setting only; no site-specific study found | Affects interpretation only, not any number | Hydrogeological surveys of the Upper Ogun |
| A13 | Recharge published for other periods and sites is comparable | Kotchoni et al. (2019): other sites, 19–25 years; Kamagaté et al. (2007): Donga sub-basin, two years | Comparison is of order of magnitude only | Well-based recharge for 2018–2024 in the catchment |
