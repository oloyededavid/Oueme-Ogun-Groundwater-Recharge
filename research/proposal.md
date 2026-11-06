# Research proposal

## Title

A Satellite Water Balance for Groundwater Recharge in Tropical Basement Catchments: Upper Ouémé (Benin) and Upper Ogun (Nigeria), 2018–2024

## Background and problem

Rural water supply across much of Benin and southwestern Nigeria comes from shallow wells in weathered crystalline basement. How much rainfall recharges these aquifers is poorly known: monitoring wells are rare, and the BGS summary for Benin states that basement recharge "is not well quantified". Free satellite products now give rainfall (CHIRPS, TAMSAT) and actual evapotranspiration (FAO WaPOR) every year, and a satellite water balance is increasingly used to estimate recharge. Whether such a balance can be trusted in basement catchments, and what it actually measures, is rarely tested against observations.

## Research gap

1. Satellite water balances are seldom checked against both observed river flow and well-based recharge in the same catchment.
2. Satellite ET includes evaporation of groundwater, so the balance measures *net* recharge, while wells measure *gross* recharge. This distinction is often left out.
3. No satellite-based recharge assessment was found for the Upper Ogun.

## Aim

To test what a WaPOR + CHIRPS/TAMSAT water balance can and cannot say about groundwater recharge in tropical basement catchments, using the monitored Upper Ouémé as a test case and the unmonitored Upper Ogun as an application.

## Objectives

1. Build matching catchment definitions for the Upper Ouémé at Bétérou and the Upper Ogun from HydroBASINS.
2. Compute annual catchment rainfall (three estimates: CHIRPS v2.0, CHIRPS v3.0, TAMSAT v3.1), actual ET and surplus (rainfall − ET) for 2018–2024, and place each year in the 1991–2020 rainfall climate.
3. Test whether the balance closes against observed river flow at Bétérou.
4. If the balance closes, bound net recharge; if it does not, find what would close it. Compare the result with published recharge from groundwater levels in Benin basement.
5. Prepare the water-table fluctuation comparison with AMMA-CATCH wells (validation, pending data access).
6. Apply the same method, unchanged, to the Upper Ogun.

## Research questions

- **Main:** Can a satellite water balance constrain groundwater recharge in tropical basement catchments?
- How much do rainfall products disagree, and how does that compare with the surplus itself?
- Does rainfall − ET agree with observed river flow at Bétérou over several years?
- How do wet and dry years differ in surplus?
- How do the two catchments compare?

## Hypotheses

- H1: Rainfall-product disagreement and ET uncertainty are of the same order as the surplus, so a satellite balance can bound but not pin down recharge.
- H2: Satellite net recharge will be lower than well-based gross recharge, because groundwater evaporation is significant in basement savanna catchments.

Results against these hypotheses are reported in the README.

## Significance

Shows where satellite water balances are useful for groundwater management in data-poor basement regions, and what measurements (river flow, wells, specific yield) are needed to make them reliable. The open code can be re-run for other catchments.

## Scope and limitations

Annual time step; catchment scale (~10,000 km²); 2018–2024 (WaPOR v3 period); no new field data. See `methodology.md` and the README.
