# Literature review

All sources below were located and checked during this project. Where only an abstract or summary was available, the statement is limited to what the abstract reports; values should be confirmed in the full text before being quoted elsewhere.

## 1. Recharge in West African crystalline basement aquifers

| Source | Setting | What it reports | Relevance |
|---|---|---|---|
| Kotchoni et al. (2019, online 2018), *Hydrogeology Journal* 27, 447–457. [doi:10.1007/s10040-018-1806-2](https://doi.org/10.1007/s10040-018-1806-2) · [open version](https://discovery.ucl.ac.uk/id/eprint/10053860/) | Benin; 19–25-year groundwater-level and rainfall records in three geological settings; mean rainfall ~1,200 mm/yr | In deeper aquifers of Mio-Pliocene sandstone and weathered crystalline rock, about **13% and 4%** of annual rainfall became recharge (abstract). Differences are attributed mainly to unsaturated-zone thickness and lithology. | Independent, well-based benchmark for the order of magnitude of recharge in basement rock under similar rainfall. |
| Vouillamoz et al. (2015), *Journal of Hydrology*. [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0022169414009299) | Hard-rock aquifers across Benin | Regional groundwater storage in metamorphic rocks of roughly 200–1,200 mm (as summarised in search results). | Shows that storage is large relative to annual recharge (a buffer), so single-year changes in storage can matter. |
| Vouillamoz et al. (2014), *Journal of Applied Geophysics*. [doi:10.1016/j.jappgeo.2014.05.012](https://doi.org/10.1016/j.jappgeo.2014.05.012) | Six hard-rock sites in Benin; magnetic resonance soundings vs pumping tests | MRS water content is about twice the specific yield; relationships for estimating specific yield carry ~10–20% uncertainty (abstract). | Source for the specific-yield range needed by the water-table fluctuation method. |
| Lachassagne, Dewandel & Wyns (2021), *Hydrogeology Journal* 29, 2561–2594. [doi:10.1007/s10040-021-02339-7](https://doi.org/10.1007/s10040-021-02339-7) · [HAL](https://hal.inrae.fr/hal-03321731/document) | Review of weathered crystalline aquifers | Aquifers develop mainly in the upper ~100 m: a low-permeability saprolite over a permeable fissured layer, which is the main water-bearing zone (abstract). Cites specific yield decreasing with depth (of the order of 1.5% to 0.2%). | Conceptual model and specific-yield magnitudes. |
| Kamagaté et al. (2007), *Comptes Rendus Géoscience* 339, 418–429. [doi:10.1016/j.crte.2007.04.003](https://doi.org/10.1016/j.crte.2007.04.003) | Donga sub-basin (586 km²) of the Upper Ouémé, Benin; two years of hydrodynamic, hydrochemical and geophysical monitoring | Recharge by direct infiltration of rainfall, 5–24% of annual rainfall; annual runoff coefficients of 14–28%; a weak groundwater contribution to river discharge (abstract). Weathered layer up to a few tens of metres; borehole abstraction is a small share of recharge. | Second published recharge level, from inside the study catchment. Supports the assumptions that pumping is minor and that much recharge may leave by evapotranspiration. |
| BGS Earthwise, *Hydrogeology of Benin*. [link](https://earthwise.bgs.ac.uk/index.php/Hydrogeology_of_Benin) | National summary | Recharge to basement aquifers is not well quantified. | States the knowledge gap directly. |
| Healy & Cook (2002), *Hydrogeology Journal* 10, 91–109. [doi:10.1007/s10040-001-0178-0](https://doi.org/10.1007/s10040-001-0178-0) | Method review | The water-table fluctuation method: recharge = specific yield × water-table rise; sensitive mainly to specific yield. | Validation method (scripted in `src/recharge/wtf.py`). |
| Scanlon, Healy & Cook (2002), *Hydrogeology Journal* 10, 18–39. [doi:10.1007/s10040-001-0176-2](https://doi.org/10.1007/s10040-001-0176-2) | Method review | Recharge methods differ in the time and space scales they represent; combining methods is recommended. | Justifies comparing a satellite balance with well-based estimates rather than trusting either alone. |

## 2. Upper Ouémé hydrology (validation catchment)

- **AMMA-CATCH observatory** ([Galle et al., 2018, *Vadose Zone Journal*, doi:10.2136/vzj2018.03.0062](https://doi.org/10.2136/vzj2018.03.0062)): long-term monitoring in the Upper Ouémé, including groundwater levels in about 20 piezometers and 28 domestic wells since 1999, with data distributed through the AMMA-CATCH database.
- **Observed river flow at Bétérou** ([Kodja et al., 2020, Proc. IAHS 383, 163–169, doi:10.5194/piahs-383-163-2020](https://doi.org/10.5194/piahs-383-163-2020)): mean annual flow 47.5 m³/s (1971–1987) and 54.5 m³/s (1988–2010), with mean annual rainfall of 1,091 mm and 1,202 mm in the same periods.
- **Catchment area at Bétérou**: 10,076 km², spanning about 9°12′–10°12′N and 1°30′–3°E ([Hydrology 5(4), 69, 2018](https://www.mdpi.com/2306-5338/5/4/69)); 10,070 km² in other GR4J applications.
- **Runoff coefficients** of 0.10–0.26 have been reported for the Ouémé at Bonou, a much larger downstream catchment ([Hydrological Sciences Journal, 2016](https://www.tandfonline.com/doi/full/10.1080/02626667.2016.1164315)), and 0.14–0.28 for the Donga sub-basin (Kamagaté et al., 2007). They are used only to judge whether the runoff ratio needed to close the balance is plausible.
- **River-level monitoring at Bétérou**: the AMMA-CATCH network includes a water-level station on the Ouémé at Bétérou ([CEOP dataset description](https://data.eol.ucar.edu/file/download/420FA8AC/CATCH_stream.txt)). Whether discharge for 2018–2024 can be obtained has not been checked.
- **Ground ET measurements**: eddy-covariance fluxes were measured over a woodland (Bellefoungou) and a cultivated site (Nalohou) in northern Benin from July 2008 to June 2010 ([Mamadou et al., 2016, *JGR Atmospheres* 121, 11269–11286, doi:10.1002/2016JD024749](https://doi.org/10.1002/2016JD024749)). The Nalohou site lies inside the Upper Ouémé catchment used here. The years predate WaPOR v3 (2018 onwards), so they are not used.

## 3. Upper Ogun (application catchment)

- No published recharge estimate specific to the Upper Ogun was found. A MIKE SHE model of the Ogun and Oshun basins simulated recharge separately for basement and sedimentary zones ([ResearchGate](https://www.researchgate.net/publication/340175451_Application_of_MIKE_SHE_Software_for_Estimation_of_Groundwater_Recharge_in_Ogun_and_Oshun_Basins_Southwestern_Nigeria)); its values were not used because the full text could not be checked.
- Hydrogeological data for the Ogun basin are scarce and borehole yields are poorly recorded ([IntechOpen overview](https://www.intechopen.com/chapters/1197340)).
- The catchment outlet follows the Ogun Catchment-to-Coast Observatory (HydroBASINS level 9 unit 1090928900).

## 4. Satellite products

| Product | Evaluation evidence | Implication |
|---|---|---|
| **WaPOR** actual ET and interception | WaPOR v2 vs 14 eddy-covariance stations across Africa: r = 0.71, RMSE 1.2 mm/day; overall error 29–31% across scales; overestimation, most consistently in irrigated areas ([Blatchford et al., 2020, *Hydrological Processes* 34, 3200–3221, doi:10.1002/hyp.13791](https://doi.org/10.1002/hyp.13791)). This project uses v3, which has not been evaluated in these catchments. | ET uncertainty is large relative to the surplus, so the result is reported with an ET sensitivity. |
| **CHIRPS v2.0** ([Funk et al., 2015, *Scientific Data* 2, 150066, doi:10.1038/sdata.2015.66](https://doi.org/10.1038/sdata.2015.66)) | Over Nigeria, CHIRPS performed best among the products tested, with TAMSAT close behind ([Remote Sensing 16(10), 1755, 2024](https://www.mdpi.com/2072-4292/16/10/1755)); an earlier study reported biases of 26.3% (CHIRPS) and 20.3% (TAMSAT) ([Ogbu et al., 2020, Climate 8(10), 103](https://doi.org/10.3390/cli8100103)). | Two rainfall products are used and their spread is reported. |
| **CHIRPS v3.0** ([CHC README](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/README-CHIRPSv3.0.txt)) | Quasi-global, 0.05°, 1981–present, with expanded station inputs. In this project its values are identical to WaPOR v3's precipitation layer. No evaluation in these catchments was found. | Treated as a separate estimate; its difference from v2.0 is reported. |
| **TAMSAT v3.1** ([Maidment et al., 2017, *Scientific Data* 4, 170063, doi:10.1038/sdata.2017.63](https://www.nature.com/articles/sdata201763)) | Africa-specific, gauge-calibrated, thermal-infrared based. | Independent algorithm from CHIRPS. |
| **HydroBASINS** ([Lehner & Grill, 2013, *Hydrological Processes* 27, 2171–2186, doi:10.1002/hyp.9740](https://doi.org/10.1002/hyp.9740)) | Global nested catchments. | Catchment boundaries. |

## 5. Methodological precedent

Satellite-based water balances with WaPOR have been used to estimate recharge in IHE Delft MSc research (e.g. Hettler, 2022, Jordan; listed on the [IHE Water Accounting theses page](https://wateraccounting.un-ihe.org/en/phd-and-msc-theses)).

## 6. Gap addressed

Recharge in basement aquifers is poorly quantified, and satellite water balances are rarely checked against both observed river flow and well-based recharge in the same catchment. This project (1) tests whether a WaPOR + CHIRPS/TAMSAT balance closes against observed river flow at Bétérou, (2) states what a satellite balance can and cannot say about recharge (net vs gross), and (3) applies the same, unchanged method to the ungauged Upper Ogun.
