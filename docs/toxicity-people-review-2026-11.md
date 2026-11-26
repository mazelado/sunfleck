# Toxicity to people: November 2026 review

Toxicity to people in the care dataset, for the 1.3 Monstera release
([roadmap](roadmap.md#monstera-simple-by-default-planned)), with the same rules as for pets:
"known to be harmful" with its source, or *unknown*, never "safe". Unlike pets, it says **how
serious** it is and **whether touching the plant** is a problem too. **Decided and applied
on 2026-11-26** (dataset 2026.11.9): every recommended option, for 101 plants
([decisions](#decided-2026-11-26)).

- **Checked:** 2026-11-26, every genus and species in `genera.yaml` (189 genera, 132 species)
  against the [NC State Extension Plant Toolbox](https://plants.ces.ncsu.edu/)'s page for it,
  and against the RHS's
  [potentially harmful garden plants](https://www.rhs.org.uk/prevention-protection/potentially-harmful-garden-plants).
- **Found:** something about people for **109 plants** (87 ornamentals, 22 food crops and
  culinary herbs): 100 with how serious it is if eaten (76 low, 20 medium, 4 high), 78 that
  irritate skin or cause an allergy, 9 of them skin only.
- **Proposed, with the recommendations below: 101 plants** record a toxicity to people. Most
  food crops record only what touching them does ([decision 3](#3-food-crops-and-herbs)).
- **Nothing is shown in the app yet.** Showing it is a separate change after the data
  ([noted for later](#noted-for-later)).

## How it was checked

- **NC State's page for each plant**, at `plants.ces.ncsu.edu/plants/<genus>-<species>/`:
  227 of the 321 have a page, and 93 of those give a toxicity to people. Each gives a
  **severity** (low, medium or high), whether it **causes contact dermatitis**, the parts and
  the toxic principle. These were read from each page's own fields.
- **The RHS's list**, which sorts plants into category A (the most toxic), B and C, and says
  for each whether it's harmful if eaten, a skin or eye irritant, or a skin allergen. 38
  entries are used. Entries that name another species than the dataset's aren't
  applied to its genus: *Mentha pulegium* (pennyroyal) isn't mint, *Brassica nigra* (black
  mustard) isn't cabbage, and ornamental *Solanum* and *Capsicum* aren't potatoes or peppers.
- **Only "harmful" is recorded.** Where a source says nothing, or that a plant is harmless,
  nothing is recorded, and the plant stays *unknown*.
- **Notes say what the source names as the toxic part**, in our own words, as the pet notes
  do ("Calcium oxalate crystals"). Where only the RHS covers a plant, the note says what it
  says, as it names no toxin. The sources' descriptions of symptoms aren't copied.
- **Genus or species,** as for pets: on the genus where a source covers the genus (NC State's
  genus page, or the RHS naming the genus); otherwise on the species.

## Decisions for the maintainer

### 1. How it's recorded

The dataset's `toxicity` is about pets, and a species with its own `toxicity` replaces its
genus's entirely. Putting people inside it would lose a genus's entry for people wherever a
species has its own for pets (*Monstera deliciosa*, for one).

| Option | Scope | Risk |
|---|---|---|
| **A. A field of its own, `harmful_to_people`** (recommended) | The schema, the loader, and the API | Low: its own inheritance from genus to species, and pet data is untouched |
| B. Inside `toxicity`, as `people:` | The schema, and a merge in the loader | Medium: the loader must merge genus and species blocks field by field |

With A, a plant would say:

```yaml
- genus: Dieffenbachia
  harmful_to_people:
    if_eaten: high          # low, medium or high; left out when only touching it matters
    skin: true              # touching it, or its sap, irritates skin or causes an allergy
    sources:
      - https://plants.ces.ncsu.edu/plants/dieffenbachia-seguine/
    note:
      en: Calcium oxalate crystals and oxalic acid
```

### 2. How serious

NC State gives low, medium or high; the RHS gives categories A, B and C.

- **A. NC State's three levels, and the RHS where NC State has none** (recommended): RHS A
  as high, B "toxic if eaten" as medium, and C "harmful if eaten" as low. 7 plants get their
  level from the RHS alone: *Dieffenbachia* (medium), and *Epipremnum*, *Syngonium*,
  *Zamioculcas*, *Hedera*, *Ficus benjamina* and *Phaseolus* (low).
- **B. No levels:** only "harmful if eaten". Simpler, but the roadmap asks how serious.

### 3. Food crops and herbs

NC State rates potato (*Solanum tuberosum*) and aubergine **high**, tomato and French bean
**medium**, and lettuce, spinach, carrot, radish, peas, parsley, mint, bay and lavender
**low**. That's about leaves, green tubers, raw beans, or eating a lot, not the part people
eat. A red "harmful if eaten" on a lettuce would mislead, and teach people to ignore it.

- **A. Record the crops where a part people might eat is harmful, and say which** 
  (recommended): potato (leaves and green tubers), tomato and aubergine (leaves and stems),
  and beans (raw). For the other crops and herbs, record only what touching them does,
  where a source says so (lettuce's and radish's sap, citrus in sunlight).
- **B. Record every crop as its source rates it.**
- **C. Record no food crops.**

### 4. When the sources disagree about skin

For 4 plants, NC State says they don't cause contact dermatitis, and the RHS that they
irritate skin or cause an allergy: peace lily (*Spathiphyllum*), taro
(*Colocasia esculenta*), *Hydrangea* and *Lobelia*.

- **A. Record skin when either source says so** (recommended): it's "known to be harmful"
  from a source, which is the rule.
- **B. Only when both say so.**

### Decided (2026-11-26)

1. **A field of its own, `harmful_to_people`** (option A), with `if_eaten`, `skin`, `sources`
   and `note`.
2. **NC State's three levels, and the RHS's where NC State has none** (option A).
3. **Food crops and herbs: only where a part people might eat is harmful** (option A):
   potato, tomato, aubergine and beans record `if_eaten`; the other crops and herbs record
   only `skin`, where a source says so.
4. **Skin when either source says so** (option A).

Applied to 101 plants: 86 with a level if eaten (62 low, 20 medium, 4 high), 15 for skin
only, 78 with `skin` in all.

## Proposed flags

**If eaten** is NC State's severity, or the RHS's mapped as in decision 2. **Skin** is a
problem when touching the plant or its sap irritates skin or causes an allergy; "RHS only"
marks where NC State doesn't say so (decision 4). **Sources:** NC State's page for the plant,
and the RHS list's category (all on
[one page](https://www.rhs.org.uk/prevention-protection/potentially-harmful-garden-plants)).

### On the genus

| Plant | If eaten | Skin | Note | Sources |
|---|---|---|---|---|
| *Monstera* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/monstera/) |
| *Philodendron* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/philodendron/), RHS C |
| *Thaumatophyllum* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/thaumatophyllum/) |
| *Epipremnum* | low | yes (RHS only) | Per the RHS: harmful if eaten; irritates skin and eyes | RHS C |
| *Anthurium* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/anthurium/), RHS C |
| *Syngonium* | low | yes (RHS only) | Per the RHS: harmful if eaten; irritates skin and eyes | RHS C |
| *Aglaonema* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/aglaonema/), RHS C |
| *Dieffenbachia* | medium | yes (RHS only) | Per the RHS: harmful if eaten; irritates skin and eyes | RHS B |
| *Spathiphyllum* | medium | yes (RHS only) | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/spathiphyllum/), RHS C |
| *Homalomena* | medium | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/homalomena/) |
| *Alocasia* | medium | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/alocasia/), RHS B |
| *Colocasia* | medium |  | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/colocasia/) |
| *Caladium* | medium | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/caladium/), RHS C |
| *Zamioculcas* | low | yes (RHS only) | Per the RHS: harmful if eaten; irritates skin and can cause an allergy | RHS C |
| *Sansevieria* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/sansevieria/) |
| *Tradescantia* | low | yes | Not identified | [NC State](https://plants.ces.ncsu.edu/plants/tradescantia/), RHS C |
| *Hedera* | low | yes (RHS only) | Per the RHS: harmful if eaten; irritates skin and can cause an allergy | RHS C |
| *Ficus* | low | yes | Ficin and furanocoumarins | [NC State](https://plants.ces.ncsu.edu/plants/ficus/) |
| *Schefflera* | — | yes (RHS only) | Per the RHS: irritates skin | RHS C |
| *Dracaena* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/dracaena/) |
| *Polyscias* | low | yes | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/polyscias/), RHS C |
| *Begonia* | low | yes | Soluble calcium oxalates | [NC State](https://plants.ces.ncsu.edu/plants/begonia/) |
| *Kalanchoe* | medium | yes | Bufadienolides | [NC State](https://plants.ces.ncsu.edu/plants/kalanchoe/) |
| *Sempervivum* | low | yes | Alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/sempervivum/) |
| *Aloe* | low | yes | Anthraquinone glycosides | [NC State](https://plants.ces.ncsu.edu/plants/aloe/), RHS C |
| *Agave* | — | yes (RHS only) | Per the RHS: irritates skin | RHS C |
| *Yucca* | — | yes (RHS only) | Per the RHS: can cause a skin allergy | RHS C |
| *Senecio* | medium | yes | Pyrrolizidine alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/senecio/) |
| *Euphorbia* | low | yes | Diterpene esters in the milky sap | [NC State](https://plants.ces.ncsu.edu/plants/euphorbia/), RHS B |
| *Adenium* | low | yes | Cardiac glycosides | [NC State](https://plants.ces.ncsu.edu/plants/adenium/), RHS C |
| *Opuntia* | — | yes (RHS only) | Per the RHS: irritates skin and eyes | RHS C |
| *Cymbidium* | — | yes (RHS only) | Per the RHS: can cause a skin allergy | RHS C |
| *Hydrangea* | low | yes (RHS only) | Cyanogenic glycosides | [NC State](https://plants.ces.ncsu.edu/plants/hydrangea/), RHS C |
| *Buxus* | low | yes | Steroidal alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/buxus/) |
| *Rhododendron* | low |  | Grayanotoxins | [NC State](https://plants.ces.ncsu.edu/plants/rhododendron/), RHS C |
| *Ilex* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/ilex/) |
| *Iris* | low | yes | Pentacyclic terpenoids and iridin | [NC State](https://plants.ces.ncsu.edu/plants/iris/), RHS C |
| *Helleborus* | high | yes | A glycoside and a saponin | [NC State](https://plants.ces.ncsu.edu/plants/helleborus/), RHS C |
| *Tagetes* | low | yes | Thiophenes, which make skin sensitive to sunlight | [NC State](https://plants.ces.ncsu.edu/plants/tagetes/) |
| *Pelargonium* | low | yes | Geraniol, linalool | [NC State](https://plants.ces.ncsu.edu/plants/pelargonium/) |
| *Lobelia* | medium | yes (RHS only) | Lobeline and other alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/lobelia/), RHS C |
| *Tulipa* | low | yes | Tulipalin and other allergens | [NC State](https://plants.ces.ncsu.edu/plants/tulipa/), RHS C |
| *Narcissus* | medium | yes | Lycorine and other alkaloids, and calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/narcissus/), RHS C |
| *Hyacinthus* | — | yes (RHS only) | Per the RHS: irritates skin | RHS C |
| *Allium* | low |  | Sulfur compounds such as N-propyl disulfide | [NC State](https://plants.ces.ncsu.edu/plants/allium/) |

### On the species

| Plant | If eaten | Skin | Note | Sources |
|---|---|---|---|---|
| *Monstera deliciosa* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/monstera-deliciosa/), RHS C |
| *Monstera adansonii* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/monstera-adansonii/) |
| *Philodendron hederaceum* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/philodendron-hederaceum/) |
| *Philodendron erubescens* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/philodendron-erubescens/) |
| *Thaumatophyllum bipinnatifidum* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/thaumatophyllum-bipinnatifidum/) |
| *Epipremnum aureum* | medium | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/epipremnum-aureum/) |
| *Rhaphidophora tetrasperma* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/rhaphidophora-tetrasperma/) |
| *Anthurium andraeanum* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/anthurium-andraeanum/) |
| *Syngonium podophyllum* | medium | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/syngonium-podophyllum/) |
| *Dieffenbachia seguine* | high | yes | Calcium oxalate crystals and oxalic acid | [NC State](https://plants.ces.ncsu.edu/plants/dieffenbachia-seguine/) |
| *Colocasia esculenta* | medium | yes (RHS only) | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/colocasia-esculenta/), RHS C |
| *Zamioculcas zamiifolia* | medium |  | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/zamioculcas-zamiifolia/) |
| *Tradescantia zebrina* | low | yes | Not identified | [NC State](https://plants.ces.ncsu.edu/plants/tradescantia-zebrina/) |
| *Tradescantia fluminensis* | low | yes | Not identified | [NC State](https://plants.ces.ncsu.edu/plants/tradescantia-fluminensis/) |
| *Hedera helix* | medium | yes | Triterpenoid saponins and polyacetylenes | [NC State](https://plants.ces.ncsu.edu/plants/hedera-helix/) |
| *Ficus lyrata* | low |  | Insoluble calcium oxalates | [NC State](https://plants.ces.ncsu.edu/plants/ficus-lyrata/) |
| *Ficus benjamina* | low | yes (RHS only) | Per the RHS: harmful if eaten; can cause a skin allergy | RHS C |
| *Schefflera arboricola* | low | yes | Calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/schefflera-arboricola/) |
| *Dracaena fragrans* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/dracaena-fragrans/) |
| *Dracaena marginata* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/dracaena-marginata/) |
| *Dracaena trifasciata* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/dracaena-trifasciata/) |
| *Pachira aquatica* | low |  | Cyclopropenoid fatty acids, in the seeds | [NC State](https://plants.ces.ncsu.edu/plants/pachira-aquatica/) |
| *Strelitzia reginae* | low |  | Stomach and gut irritants, mainly in the fruit and seeds | [NC State](https://plants.ces.ncsu.edu/plants/strelitzia-reginae/) |
| *Strelitzia nicolai* | low | yes | Not identified | [NC State](https://plants.ces.ncsu.edu/plants/strelitzia-nicolai/) |
| *Cordyline fruticosa* | low | yes | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/cordyline-fruticosa/) |
| *Cordyline australis* | low |  | Saponins | [NC State](https://plants.ces.ncsu.edu/plants/cordyline-australis/) |
| *Codiaeum variegatum* | low | yes | Diterpene esters | [NC State](https://plants.ces.ncsu.edu/plants/codiaeum-variegatum/) |
| *Chamaedorea elegans* | low | yes | Not identified | [NC State](https://plants.ces.ncsu.edu/plants/chamaedorea-elegans/) |
| *Dypsis lutescens* | low |  | Cyanogenic glycosides | [NC State](https://plants.ces.ncsu.edu/plants/dypsis-lutescens/) |
| *Kalanchoe blossfeldiana* | medium |  | Bufadienolides | [NC State](https://plants.ces.ncsu.edu/plants/kalanchoe-blossfeldiana/) |
| *Aloe vera* | low | yes | Anthraquinone glycosides | [NC State](https://plants.ces.ncsu.edu/plants/aloe-vera/) |
| *Curio rowleyanus* | low | yes | Pyrrolizidine alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/curio-rowleyanus/) |
| *Euphorbia milii* | low | yes | Diterpene esters in the milky sap | [NC State](https://plants.ces.ncsu.edu/plants/euphorbia-milii/) |
| *Euphorbia trigona* | medium | yes | Diterpene esters | [NC State](https://plants.ces.ncsu.edu/plants/euphorbia-trigona/) |
| *Euphorbia tirucalli* | low | yes | Diterpene esters in the milky sap | [NC State](https://plants.ces.ncsu.edu/plants/euphorbia-tirucalli/) |
| *Adenium obesum* | low | yes | Cardiac glycosides | [NC State](https://plants.ces.ncsu.edu/plants/adenium-obesum/) |
| *Ananas comosus* | low | yes | Bromelain and calcium oxalate crystals | [NC State](https://plants.ces.ncsu.edu/plants/ananas-comosus/) |
| *Hydrangea macrophylla* | low |  | Cyanogenic glycosides | [NC State](https://plants.ces.ncsu.edu/plants/hydrangea-macrophylla/) |
| *Buxus sempervirens* | low | yes | Steroidal alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/buxus-sempervirens/) |
| *Tagetes patula* | low | yes | Thiophenes, which make skin sensitive to sunlight | [NC State](https://plants.ces.ncsu.edu/plants/tagetes-patula/) |
| *Tropaeolum majus* | — | yes (RHS only) | Per the RHS: can cause a skin allergy | RHS C |
| *Hyacinthus orientalis* | medium | yes | Lycorine and other alkaloids | [NC State](https://plants.ces.ncsu.edu/plants/hyacinthus-orientalis/) |

### Food crops and culinary herbs ([decision 3](#3-food-crops-and-herbs))

| Plant | If eaten (as the sources say) | Proposed | Skin | Note | Sources |
|---|---|---|---|---|---|
| *Salvia rosmarinus* | — | **—** | yes (RHS only) | Per the RHS: can cause a skin allergy | RHS C |
| *Lavandula angustifolia* | low | **not recorded** |  | Linalool, linalyl acetate | [NC State](https://plants.ces.ncsu.edu/plants/lavandula-angustifolia/) |
| *Laurus nobilis* | low | **not recorded** |  | Eugenol and other essential oils | [NC State](https://plants.ces.ncsu.edu/plants/laurus-nobilis/) |
| *Petroselinum crispum* | low | **not recorded** |  | Furanocoumarins | [NC State](https://plants.ces.ncsu.edu/plants/petroselinum-crispum/) |
| *Mentha spicata* | low | **not recorded** |  | Essential oils | [NC State](https://plants.ces.ncsu.edu/plants/mentha-spicata/) |
| *Mentha × piperita* | low | **not recorded** |  | Essential oils | [NC State](https://plants.ces.ncsu.edu/plants/mentha-x-piperita/) |
| *Solanum lycopersicum* | medium | **medium** |  | Tomatine and solanine, in the leaves and stems | [NC State](https://plants.ces.ncsu.edu/plants/solanum-lycopersicum/) |
| *Solanum melongena* | high | **high** |  | Solanine and other alkaloids, in the leaves | [NC State](https://plants.ces.ncsu.edu/plants/solanum-melongena/) |
| *Solanum tuberosum* | high | **high** |  | Solanine and other alkaloids, in the leaves, stems and green tubers | [NC State](https://plants.ces.ncsu.edu/plants/solanum-tuberosum/), RHS C |
| *Phaseolus* | low | **low** |  | Per the RHS: raw beans and pods are harmful if eaten | RHS C |
| *Phaseolus vulgaris* | medium | **medium** |  | Phytohaemagglutinin, a lectin, in raw beans | [NC State](https://plants.ces.ncsu.edu/plants/phaseolus-vulgaris/) |
| *Phaseolus coccineus* | low | **low** |  | Traces of phytohaemagglutinin, a lectin, in raw beans | [NC State](https://plants.ces.ncsu.edu/plants/phaseolus-coccineus/) |
| *Pisum* | low | **not recorded** |  | Oxalyldiaminopropionic acid, in some peas | [NC State](https://plants.ces.ncsu.edu/plants/pisum/) |
| *Lactuca sativa* | low | **not recorded** | yes | Lactucin and lactucopicrin, in the milky sap | [NC State](https://plants.ces.ncsu.edu/plants/lactuca-sativa/) |
| *Spinacia oleracea* | low | **not recorded** |  | Oxalic acid | [NC State](https://plants.ces.ncsu.edu/plants/spinacia-oleracea/) |
| *Daucus carota* | low | **not recorded** | yes | Falcarinol | [NC State](https://plants.ces.ncsu.edu/plants/daucus-carota/) |
| *Raphanus sativus* | low | **not recorded** | yes | Isothiocyanates | [NC State](https://plants.ces.ncsu.edu/plants/raphanus-sativus/) |
| *Citrus* | — | **—** | yes (RHS only) | Per the RHS: the sap or fruit can burn skin in sunlight | RHS C |
| *Citrus × limon* | low | **not recorded** | yes | Essential oils and psoralens | [NC State](https://plants.ces.ncsu.edu/plants/citrus-x-limon/) |
| *Citrus × sinensis* | low | **not recorded** | yes | Essential oils and psoralens | [NC State](https://plants.ces.ncsu.edu/plants/citrus-x-sinensis/) |
| *Allium cepa* | low | **not recorded** |  | Sulfur compounds such as N-propyl disulfide | [NC State](https://plants.ces.ncsu.edu/plants/allium-cepa/) |
| *Allium sativum* | low | **not recorded** | yes | Sulfur compounds such as N-propyl disulfide | [NC State](https://plants.ces.ncsu.edu/plants/allium-sativum/), RHS B |

## Not found

- **No page at NC State** for 94 of the 321, often because it files the plant under another
  name or only has its species. The RHS list covers some of them; the rest stay *unknown*.
- **A page, but nothing about people**, for 134 of NC State's 227 pages (most herbs and
  houseplants it lists, such as *Calathea* and *Peperomia*). They stay *unknown*.

## Noted for later

- **Showing it in the app,** after the data: on a species' page and a plant's page, next to
  toxicity to pets, with "how serious if eaten" in words, and "touching it" when `skin`. Like
  pets, *unknown* is said as such, never as "safe". A separate PR, with its own design.
- **Spanish** for the notes, with the care profiles' (decided in
  [the Spanish review](spanish-care-data-2026-11.md#decided-2026-11-26)).
- **More sources** for the plants NC State doesn't cover: poison control centres, as the
  roadmap names, for a later review.

## Sources

- NC State Extension Gardener Plant Toolbox: each plant's page, linked above, read on
  2026-11-26.
- Royal Horticultural Society,
  [Potentially harmful garden plants](https://www.rhs.org.uk/prevention-protection/potentially-harmful-garden-plants),
  read on 2026-11-26.
