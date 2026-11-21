# Closet: AI Outfit Recommendation Model Evaluation and Selection

Nov 21, 2026 · @Bebzoo

**A Requirements-Driven Comparative Case Study of ChatGPT, Gemini, and Claude**

CSCE 3701 Software Engineering · The American University in Cairo · Instructor: Dr. Sherif Aly · Team Closet: Habiba Khashaba, Youssef Ezzeldin, Bashar Elazony, Karim Eid, Salma Fahim

## Executive summary

We selected **Anthropic Claude** as the preferred AI provider for Closet's outfit recommendation engine. Our final overall evaluation scores were **Claude 96%, ChatGPT 95% and Gemini 93%**.

We reached this decision by treating model selection as a software engineering problem. We first defined what Closet's recommendation engine must do. We then built one controlled 22-item wardrobe with unique item IDs and ran four standardized scenarios through each assistant's chat interface: campus to coffee, an elegant dinner, winter layering under constraints, and a heavily restricted wardrobe. Each scenario was scored out of 100.

Across the four scenarios, Claude's per-experiment average was 94.50, ChatGPT's 93.75 and Gemini's 88.25. The final overall scores of 96%, 95% and 93% are a separate set of figures from our final evaluation; they are not the arithmetic averages of the four tests, and Section 8 explains how we treat them.

Claude was preferred because it combined sophisticated styling with practical, occasion-aware recommendations, respected wardrobe restrictions, and recognized when the wardrobe could not satisfy a request. ChatGPT performed very closely, so we do not claim Claude is better in general.

This was a fashion-quality evaluation of consumer chat interfaces. It does **not** measure the Claude API's latency, JSON validity, cost or consistency. Those must be verified separately before the selection is final at the API level (Section 12).

## 1. Background: why Closet needs an AI model

Closet is an AI-powered digital wardrobe. Its central feature is an outfit recommendation engine that suggests three personalized outfits from the clothes a user already owns.

A recommendation has to account for:

- the clothing the user actually owns, and whether each piece is available;
- occasion and dress code;
- weather;
- personal style and modesty preferences;
- colour coordination and silhouette compatibility;
- user feedback;
- practicality and comfort.

We wanted recommendations that are fashionable, not only technically valid. A white shirt with black trousers is acceptable but shows little fashion understanding. We wanted combinations of colour, texture, proportion and layering that a user might save on Pinterest.

Creativity could never come at the expense of the application's constraints. The model must not recommend unavailable clothing, invent garments, or assume garment properties it was not given. This created an engineering trade-off between **aesthetic quality**, **constraint satisfaction** and **reliability**, and our objective was to find the provider that balanced them best for this feature.

## 2. Candidate models

We compared three consumer AI assistants:

1. OpenAI ChatGPT
2. Google Gemini
3. Anthropic Claude

All experiments were run through each assistant's **chat interface**, using standardized prompts and identical wardrobe information. The purpose was exploratory: to narrow our API candidates before implementing one provider in Closet.

Testing a consumer chat application is not equivalent to benchmarking its production API. Model versions, system settings and output behaviour can differ between the two, so the results describe chat behaviour only.

## 3. Our evaluation process

We ran the evaluation as four engineering decisions, in order.

### Stage 1 — Define the selection criteria

| Criterion | Why it matters for Closet |
| --- | --- |
| Fashion quality | The product promise is outfits users want to wear, not just valid combinations. |
| Colour coordination | Colour is the first thing users judge; clashing looks erode trust in every later suggestion. |
| Styling creativity | Users already know their basic combinations; value comes from looks they would not have built themselves. |
| Occasion suitability | A good outfit for the wrong occasion is a failed recommendation. |
| Weather awareness | Closet passes real weather; an outfit too cold for the evening is wrong, however stylish. |
| Outfit diversity | Three looks must be three real options, not one outfit with different accessories. |
| Personalization | Style, modesty and comfort preferences must shape the result. |
| Availability compliance | Pieces in the laundry, packed or lent out must never appear; this is a hard rule. |
| Practicality | Users walk, commute and sit through lectures in these clothes. |
| Explanation quality | Short reasons help users trust and learn from a suggestion. |
| Recognizing insufficient options | When the wardrobe cannot meet the request, saying so is the correct answer. |

### Stage 2 — Create a controlled wardrobe

We built one standardized wardrobe of 22 items, each with a unique ID from W01 to W22 (full list in Appendix A). The IDs let us check every recommended piece against the wardrobe, so we could detect unavailable or invented items exactly rather than by reading descriptions.

### Stage 3 — Standardize the prompts

Within each scenario, all three models received the same prompt: the same wardrobe, user requirements, weather, availability restrictions and output instructions. No model received extra styling information or different constraints. Holding these inputs fixed made differences in output attributable to the model rather than to the prompt.

### Stage 4 — Evaluate the recommendations

We reviewed each response's outfit combinations, styling explanations, occasion suitability and constraint compliance, and assigned a score out of 100 per scenario using that scenario's criteria. These were exploratory, team-assigned scores, not a blinded statistical study with many independent reviewers.

## 4. Experiment 1 — Campus to Coffee

**Objective:** everyday coordination, styling creativity and practicality.

**Scenario:** a university student in Cairo goes to campus, then coffee with friends; 20°C; Pinterest-style elevated casual with Scandinavian minimalism; comfortable footwear. W12 (charcoal pleated trousers) unavailable, in the laundry.

**Scores:** ChatGPT 94 · Claude 94 · Gemini 89.

**Findings.** ChatGPT produced strong statement styling: the burgundy leather jacket (W01) with dark-wash wide-leg jeans (W09), the cream fitted top (W04), burgundy Samba sneakers (W16) and matching accessories. Claude produced a sophisticated and practical look: the charcoal blazer (W03), light-wash jeans (W10), cream top (W04) and burgundy sneakers (W16). Gemini's tonal outfits were attractive, but some were more heavily layered or formal than a campus day needs.

**Conclusion and next step.** ChatGPT and Claude tied, with different strengths: ChatGPT leaned creative, Claude practical. One casual scenario could not separate them, so rather than choosing a model we tested a different occasion.

## 5. Experiment 2 — Elegant Evening Dinner

**Objective:** sophisticated evening styling, texture coordination and adaptation to a new occasion.

**Scenario:** upscale dinner in Cairo; 17°C; elegant, feminine, fashion-forward; Scandinavian and European evening styling. W12 unavailable.

**Scores:** ChatGPT 95 · Claude 95 · Gemini 93.

**Findings.** ChatGPT's "Bordeaux After Dark" combined the burgundy leather jacket (W01), chocolate knit top (W06), black satin midi skirt (W13), black kitten heels (W18) and burgundy accessories. Claude's "Merlot Noir" used the burgundy cardigan (W07) worn as a top, the black satin midi skirt (W13) and burgundy leather outerwear (W01). Gemini showed interesting tonal combinations of chocolate brown, charcoal and burgundy.

**Conclusion and next step.** ChatGPT and Claude tied again. Two experiments showed both could generate strong fashion, but neither tested behaviour under hard practical restrictions, which is where a production engine is most likely to fail. We designed Experiment 3 for that.

## 6. Experiment 3 — Winter Layering Under Constraints

**Objective:** whether a model puts realistic requirements ahead of attractive but unsuitable outfits.

**Scenario:** Cairo, 9°C, windy evening; dinner, then a 30-minute outdoor walk; Scandinavian winter street style. Unavailable: W02 (borrowed), W04 (laundry), W12 (laundry), W17 (packed). The prompt forbade assuming insulation, lining or thickness not stated in the descriptions.

**Scores:** Claude 94 · ChatGPT 93 · Gemini 79.

**Findings.** ChatGPT recognized that the wardrobe had no confirmed insulation and stated explicitly that no outfit could be verified as fully weather-appropriate. Claude returned only **two** outfits instead of forcing three, identified the wardrobe's limitations and gave practical layering advice, although it still assumed some warmth without verified thermal properties. Gemini recognized several limitations but rated winter suitability more confidently than the garment information justified.

**Conclusion and next step.** Claude ranked first, with ChatGPT close behind. The key lesson: a reliable engine must recognize when the wardrobe cannot satisfy the request, and must not trade correctness for a complete-looking answer. We then tested the opposite pressure: many items removed, but an occasion the wardrobe can still serve.

## 7. Experiment 4 — Restricted Wardrobe

**Objective:** constraint compliance, and fashion quality when many items are unavailable.

**Scenario:** a university presentation followed by dinner, with no change of clothes; Cairo, 19°C; sophisticated styling. Eight items unavailable: W01, W02, W04, W09, W11, W12, W16, W18, leaving 14.

**Scores:** Claude 95 · ChatGPT 93 · Gemini 92.

**Findings.** All three assistants avoided all eight unavailable garments. Claude created three distinct outfits with strong day-to-evening adaptability; its best combined the chocolate knit top (W06), dark chocolate maxi skirt (W14), burgundy cardigan (W07) and brown ankle boots (W17). ChatGPT produced strong tailoring-based looks and acknowledged uncertainty about an off-shoulder neckline (W08) in a formal presentation. Gemini coordinated colour well and identified the available pieces correctly, but some explanations relied on garment construction details that were never specified.

**Conclusion.** Claude scored highest for its balance of colour coordination, practicality and suitability across both occasions.

## 8. Results

Claude received the highest final overall score, **96%**, followed by ChatGPT at **95%** and Gemini at **93%**. We report two separate sets of figures: the per-experiment scores from the four tests, and the final overall scores from our final evaluation.

### Per-experiment scores

&#91;embedded content: Team-assigned scores, four standardized chat-interface experiments\]

Weighting the four scenarios equally gives per-experiment averages of 94.50 (Claude), 93.75 (ChatGPT) and 88.25 (Gemini); the calculation is in Appendix B. Claude's 0.75-point lead over ChatGPT is small and should not be read as conclusive evidence of better general performance. We computed no confidence intervals or significance tests; with four team-scored scenarios they would not be meaningful.

### Final overall scores

&#91;embedded content: Final overall scores from the team's final evaluation; averages computed from the four experiments\]

The final overall scores (96%, 95%, 93%) are **not** the arithmetic averages of the four tests: those are 94.50, 93.75 and 88.25. They are the overall scores our team reported from our final evaluation. Our records do not document how they were derived (no formula, weighting scheme or additional scored experiment), so we present them as reported and do not reconstruct a method. Both measures give the same ranking, Claude first, ChatGPT second, Gemini third; the final scores narrow Gemini's gap, mostly because its per-experiment average is pulled down by one test (79 in winter layering).

## 9. What we learned from the experiments

The scores matter less than what the four scenarios taught us about building the feature.

**A. Fashion quality alone is not sufficient.** Experiments 1 and 2 produced beautiful outfits from all three models. Experiment 3 showed that a beautiful outfit is still a wrong answer if it is too cold for a 30-minute walk at 9°C.

**B. Wardrobe constraints are mandatory.** All three models respected the eight-item restriction in Experiment 4, but Closet cannot rely on that. Availability must be enforced by the application, whatever the model does.

**C. The AI must recognize limitations.** The strongest Experiment 3 answers said the wardrobe could not fully meet the request; Claude returned two outfits rather than three. Closet must allow "fewer than three" with an explanation as a valid outcome.

**D. Personalization is more than colour matching.** Comfort, weather, dress code, style, silhouette and practicality all shaped which answers we scored highest; the off-shoulder sweater in a presentation (Experiment 4) is an example.

**E. Structured validation remains necessary.** Even a strong model can return a wrong ID or an unavailable piece. The backend must independently check garment IDs, availability, outfit completeness and response format.

**F. Models make unsupported assumptions.** Claude and Gemini both assumed warmth or construction details that the metadata did not state. Closet should prompt the model to say what it does not know, and our metadata should carry the properties outfits depend on (for example fabric and season).

These lessons set our engineering approach: the model proposes, Closet's own rules decide what is shown (Section 11).

## 10. Selection rationale: why we preferred Anthropic Claude

We preferred Claude on the strength of the whole evaluation, not one outfit. Across the four experiments and our final evaluation, Claude:

- received the highest final overall score (96%) and the highest per-experiment average (94.50);
- produced consistently sophisticated outfits, tying or leading in every scenario;
- showed strong occasion awareness, especially in the day-to-evening scenario;
- gave practical styling instructions (how to layer, tuck and wear each piece);
- respected wardrobe restrictions in the experiments we ran;
- recognized limitations in the hardest scenario, returning two valid outfits rather than forcing three.

After the four experiments we also tried Claude in further informal use and preferred the styling of its recommendations. This is a qualitative team preference, not a separate scored experiment.

### Why these capabilities matter for Closet

| Capability we observed | Why it matters for Closet users |
| --- | --- |
| Sophisticated, Pinterest-style looks | Users open Closet to get looks they would not have put together themselves. |
| Practical, occasion-aware choices | A university student walks between lectures, then goes out; outfits must work for the actual day. |
| Personalization | Style, modesty and comfort preferences are set during onboarding and must visibly shape results. |
| Constraint awareness | Closet tracks laundry, packed, borrowed and repair status; suggesting an unavailable piece breaks trust at once. |
| Admitting limits | An honest "your wardrobe can't do this, here's why" is more useful than a cold or invented outfit. |

The margin is small. ChatGPT finished one point lower overall and 0.75 points lower on the per-experiment average, and it led on statement styling and on flagging uncertainty in Experiment 3. Our preference reflects both the scores and our direct qualitative assessment; it is not evidence that Claude is better in general.

## 11. Engineering integration decision

We intend Claude to propose outfits and explain them, while Closet's backend keeps control of what is shown. The proposed flow (drawn in Appendix D):

1. The user requests an outfit.
2. The Closet backend retrieves the user's wardrobe.
3. Availability filtering removes laundry, packed, borrowed and repair items.
4. Preferences and weather are processed.
5. The backend sends the AI recommendation request to the Claude API.
6. Claude returns a structured outfit response.
7. Backend validation checks the response.
8. Up to three valid recommendations are displayed.

Validation is essential because the experiments showed even strong models can assume or slip. The backend should check that:

- every returned garment ID exists;
- every item belongs to the requesting user;
- every item is currently available;
- each outfit has suitable categories (top and bottom, or a dress, plus shoes);
- the response meets the request's other required constraints;
- invalid or incomplete results are rejected, or regenerated under a controlled retry policy, falling back to Closet's rule engine.

All model calls go through a **provider-independent adapter**. The rest of Closet calls the adapter, never a vendor SDK, so switching to OpenAI or another provider is a configuration change, not a rewrite.

### What is implemented today versus proposed

| Part | Status in the current Closet code |
| --- | --- |
| Provider-independent adapter (Anthropic or OpenAI, chosen by configuration) | Implemented (`server/src/shared/llm.js`). |
| Rule engine that picks three outfits from available pieces only | Implemented and unit-tested. |
| Claude writing grounded Ask Closet replies and stylist notes on rule-engine outfits | Implemented; a note that does not mention a piece in its own look is discarded. |
| Claude proposing photo details, validated against Closet's vocabulary | Implemented. |
| Fallback to "Closet rules" with no key or on any provider error | Implemented and tested with a fake model. |
| Claude itself choosing the three outfits, validated and retried as above | **Proposed**, not yet implemented. |
| Tests against the live Claude API | **Not yet run**; automated tests use a fake model with no network. |

## 12. API selection status

Our evaluation has two stages, and only the first is complete.

|  | Stage A — Fashion recommendation evaluation | Stage B — API technical evaluation |
| --- | --- | --- |
| Status | **Completed** | **Not yet verified** |
| Method | Four standardized scenarios in consumer chat interfaces, plus a final overall evaluation | Planned: 15 scenario prompts from a synthetic 22-item wardrobe, each run 3 times per provider (135 API calls), using our prepared benchmark kit |
| Result | Claude 96% · ChatGPT 95% · Gemini 93% | None yet. The kit has been prepared but no API calls have been made, so it provides no comparative evidence. |

Stage B must measure:

- actual Claude API response latency;
- structured JSON validity;
- cost per successful request;
- consistency across repeated requests;
- error-handling behaviour (failures, truncation, rate limits);
- security and integration;
- comparison against the equivalent OpenAI API implementation.

The kit checks some of these automatically: JSON syntax, invented IDs, unavailable or banned items, modesty conflicts, outfit completeness and duplicate outfits. Colour harmony, weather suitability and style quality still need blind human review of its grading sheet.

**Preferred AI provider:** Anthropic Claude.

**Basis:** the fashion-quality evaluation (Stage A) and our qualitative preference.

**API integration validation:** to be confirmed with actual API evidence (Stage B).

This distinction matters because a model's chatbot behaviour does not prove its API version behaves the same way. The chat products may also run a different model than the one Closet's adapter calls by default (`claude-haiku-4-5`), so Stage B must test that exact model.

## 13. Limitations

- **Few scenarios:** four, all designed by us.
- **One wardrobe:** a single 22-item wardrobe, not real user closets.
- **Subjective scoring:** scores were assigned by our team.
- **No blinded raters:** reviewers knew which model wrote each answer.
- **Chat interfaces, not APIs:** consumer apps rather than controlled API endpoints.
- **Uncontrolled versions and settings:** model versions, temperature and system prompts were not fixed or recorded.
- **No latency or token measurements.**
- **No verified API cost.**
- **Limited garment information:** text descriptions only, no photos; fabric weight, lining and fit were unknown.
- **Undocumented final scoring:** the method behind the final overall scores is not recorded in our evidence (Section 8).

These limits do not invalidate the exploration: inputs were standardized and differences were consistent with what we read in the answers. They do limit the claim to a preliminary, requirements-driven preference, not a general ranking of the three models.

## 14. Final conclusion

We did not choose an AI provider by brand popularity. We defined Closet's requirements, designed four realistic Closet-specific scenarios, standardized the inputs, and examined both recommendation quality and constraint compliance.

The evidence suggests Claude offers the strongest overall combination of fashion quality, practicality and awareness of wardrobe restrictions, with ChatGPT performing very closely. Claude received the highest final overall score (96%) and the highest per-experiment average (94.50).

We therefore selected Claude as our preferred provider for further integration and validation. The decision is requirements-driven: Closet's backend keeps the rules, and Claude adds the styling. API-level performance still needs its own evidence before the choice is final.

## References

- [Anthropic Messages API documentation](https://docs.anthropic.com/en/api/messages)
- [OpenAI Responses API reference](https://platform.openai.com/docs/api-reference/responses)
- [Google Gemini generateContent API reference](https://ai.google.dev/api/generate-content)
- Closet project repository: `server/src/shared/llm.js` (provider adapter), `server/src/modules/ai/aiFeatures.js` (grounded AI features).

## Appendix A — Original experimental prompts and testing protocol

The prompts below are the instructions we actually used, reproduced as given. Within each test, ChatGPT, Gemini and Claude received the same prompt. Each test lists its objective, prompt, restrictions, evaluation criteria, results and how it shaped the next test.

### Test 1 — Campus to Coffee

**Objective:** casual outfit coordination, fashion creativity, comfortable styling and everyday practicality.

**Restrictions:** W12 unavailable (laundry).

**Evaluation criteria:** colour harmony, silhouettes and layering, creativity, comfort for walking, distinct outfits, constraint compliance.

```text
You are the AI fashion stylist for Closet, a personal digital wardrobe app. Your job is to create genuinely fashionable, Pinterest-worthy outfits from clothes I already own.

MY WARDROBE:
W01 Burgundy oversized leather jacket — Available
W02 Chocolate brown suede jacket — Available
W03 Charcoal oversized tailored blazer — Available
W04 Cream fitted long-sleeve top — Available
W05 White oversized poplin shirt — Available
W06 Chocolate brown fitted knit top — Available
W07 Burgundy fine-knit cardigan — Available
W08 Grey off-shoulder knit sweater — Available
W09 Dark-wash wide-leg jeans — Available
W10 Light-wash straight-leg jeans — Available
W11 Cream tailored wide-leg trousers — Available
W12 Charcoal pleated trousers — Laundry (UNAVAILABLE)
W13 Black satin midi skirt — Available
W14 Dark chocolate maxi skirt — Available
W15 Black leather loafers — Available
W16 Burgundy Adidas Samba sneakers — Available
W17 Brown pointed-toe ankle boots — Available
W18 Black kitten heels — Available
W19 Burgundy shoulder bag — Available
W20 Chocolate brown structured handbag — Available
W21 Gold hoop earrings — Available
W22 Brown leather belt — Available

THE OCCASION:
I am a 21-year-old university student in Cairo going to campus, then meeting friends for coffee. The weather is 20°C. I want to look effortlessly chic, fashionable, and put together without looking overdressed. I love Pinterest-style elevated casual outfits, Scandinavian minimalism, and interesting color combinations. I prefer comfortable footwear because I will walk around campus.

YOUR TASK:
Create THREE complete and genuinely different outfits from my wardrobe. Make each one look like a thoughtfully styled fashion-editorial outfit, not a generic random combination.

STRICT RULES:
1. Use ONLY the items listed above, by their exact W IDs.
2. Never select W12 because it is in laundry.
3. Every outfit must contain a suitable top or dress, bottom where appropriate, and shoes. Include outerwear and accessories when they improve the outfit.
4. Prioritize color harmony, silhouettes, layering, texture and proportions.
5. Make all three outfits visually distinct, not simply the same outfit with different accessories.
6. Do not invent items, colors, or accessories.
7. Do not suggest purchases.
8. If you cannot make three valid outfits, explicitly explain why.

FOR EACH OUTFIT PROVIDE:
- An original outfit name.
- Every item selected, with its ID.
- Why the colors, textures, and proportions work.
- What makes the outfit fashionable rather than basic.
- A fashion score out of 10, with a brief justification.

Finally, select your single strongest outfit and explain why it wins.
```

**Results:** ChatGPT 94 · Claude 94 · Gemini 89. ChatGPT led on statement styling, Claude on practicality; Gemini was sometimes more layered or formal than needed.

**Influence on the next test:** the tie meant one casual scenario could not separate the models, so Test 2 changed the occasion to evening dressing.

### Test 2 — Elegant Formal Dinner

**Objective:** sophisticated evening styling, outfit diversity, texture combinations and occasion suitability.

**Restrictions:** W12 unavailable (laundry). The original prompt reused the Test 1 wardrobe; it is reproduced in full here.

**Evaluation criteria:** evening suitability, texture contrast, distinct silhouettes and palettes, 17°C layering, exact styling instructions, constraint compliance.

```text
You are the AI fashion stylist for Closet, a personal digital wardrobe application. Your responsibility is to create genuinely stylish, sophisticated, Pinterest-worthy evening outfits using ONLY clothes the user already owns.

MY WARDROBE:
W01 Burgundy oversized leather jacket — Available
W02 Chocolate brown suede jacket — Available
W03 Charcoal oversized tailored blazer — Available
W04 Cream fitted long-sleeve top — Available
W05 White oversized poplin shirt — Available
W06 Chocolate brown fitted knit top — Available
W07 Burgundy fine-knit cardigan — Available
W08 Grey off-shoulder knit sweater — Available
W09 Dark-wash wide-leg jeans — Available
W10 Light-wash straight-leg jeans — Available
W11 Cream tailored wide-leg trousers — Available
W12 Charcoal pleated trousers — Laundry (UNAVAILABLE)
W13 Black satin midi skirt — Available
W14 Dark chocolate maxi skirt — Available
W15 Black leather loafers — Available
W16 Burgundy Adidas Samba sneakers — Available
W17 Brown pointed-toe ankle boots — Available
W18 Black kitten heels — Available
W19 Burgundy shoulder bag — Available
W20 Chocolate brown structured handbag — Available
W21 Gold hoop earrings — Available
W22 Brown leather belt — Available

THE OCCASION:
I am a 21-year-old woman going to an elegant dinner at an upscale restaurant in Cairo on a Saturday evening. The temperature is 17°C, so I may need an appropriate layer.

I want to look sophisticated, feminine, polished, and fashion-forward. My inspiration is Pinterest evening fashion, Scandinavian minimalism, elevated European street style, and refined contemporary tailoring.

I want to look expensive and thoughtfully styled, without looking corporate, boring, overdressed for a gala, or too casual for an upscale dinner.

YOUR TASK:
Create THREE complete, fashionable, and genuinely different evening outfits using only my wardrobe.

Do not default to generic combinations. Think like an experienced fashion stylist who understands color theory, silhouettes, texture contrast, proportions, and contemporary evening dressing.

STRICT RULES:
1. Use ONLY the provided wardrobe items and identify every selected piece by its exact W ID.
2. NEVER select W12 because it is in laundry.
3. Every outfit must include a suitable top, bottom, and footwear, with outerwear and accessories when appropriate.
4. All three outfits must be suitable for an elegant dinner, not ordinary daytime university outfits.
5. Make the outfits genuinely distinct in silhouette, color palette, and styling direction.
6. Prioritize sophisticated color combinations and interesting texture contrasts.
7. Consider the 17°C evening temperature.
8. Do not invent any garments, jewelry, shoes, or accessories.
9. Do not suggest purchasing anything.
10. The outfits must be realistic and wearable, not just visually interesting.
11. Avoid repeating identical outfit formulas or merely changing accessories.
12. If three suitable outfits cannot be created, clearly explain the limitation rather than compromising mandatory requirements.

FOR EACH OUTFIT PROVIDE:
- A creative, fashion-editorial outfit name.
- Every selected item with its wardrobe ID.
- Exact styling instructions: how to tuck, layer, button, or proportion the garments.
- An explanation of the colors, textures, and silhouettes.
- What makes the outfit fashion-forward rather than basic.
- Why it suits the elegant dinner and 17°C weather.
- A fashion score out of 10 with a short justification.

Finally, choose your SINGLE strongest evening outfit, explain why it wins, and identify its wardrobe item IDs.

Be fashionable, original, tasteful, and realistic. Prioritize exceptional outfit styling over lengthy descriptions.
```

**Results:** ChatGPT 95 · Claude 95 · Gemini 93. "Bordeaux After Dark" (ChatGPT) and "Merlot Noir" (Claude) were the strongest looks.

**Influence on the next test:** both leaders generated strong fashion, but no test yet forced a trade-off between looks and real-world suitability, so Test 3 added cold weather and more unavailable items.

### Test 3 — Winter Layering Challenge

**Objective:** whether the models put weather suitability and availability ahead of fashion aesthetics.

**Restrictions:** W02 (borrowed), W04 (laundry), W12 (laundry), W17 (packed) unavailable; no assumed insulation, lining, thickness or weather resistance.

**Evaluation criteria:** warmth for a windy 9°C walk, honest suitability scoring, outdoor-to-indoor layering, distinct outfits, willingness to return fewer than three, constraint compliance.

```text
You are the AI fashion stylist for Closet, an intelligent digital wardrobe application. Your task is to create truly fashionable, Pinterest-worthy winter outfits using ONLY the clothes I actually own and that are currently available.

THIS IS A CONTROLLED FASHION RECOMMENDATION TEST. Follow every wardrobe restriction carefully. Do not invent garments, accessories, materials, or unlisted thermal clothing.

MY WARDROBE:
W01 — Burgundy oversized leather jacket — AVAILABLE
W02 — Chocolate brown suede jacket — BORROWED (UNAVAILABLE)
W03 — Charcoal oversized tailored blazer — AVAILABLE
W04 — Cream fitted long-sleeve top — LAUNDRY (UNAVAILABLE)
W05 — White oversized poplin shirt — AVAILABLE
W06 — Chocolate brown fitted knit top — AVAILABLE
W07 — Burgundy fine-knit cardigan — AVAILABLE
W08 — Grey off-shoulder knit sweater — AVAILABLE
W09 — Dark-wash wide-leg jeans — AVAILABLE
W10 — Light-wash straight-leg jeans — AVAILABLE
W11 — Cream tailored wide-leg trousers — AVAILABLE
W12 — Charcoal pleated trousers — LAUNDRY (UNAVAILABLE)
W13 — Black satin midi skirt — AVAILABLE
W14 — Dark chocolate maxi skirt — AVAILABLE
W15 — Black leather loafers — AVAILABLE
W16 — Burgundy Adidas Samba sneakers — AVAILABLE
W17 — Brown pointed-toe ankle boots — PACKED (UNAVAILABLE)
W18 — Black kitten heels — AVAILABLE
W19 — Burgundy shoulder bag — AVAILABLE
W20 — Chocolate brown structured handbag — AVAILABLE
W21 — Gold hoop earrings — AVAILABLE
W22 — Brown leather belt — AVAILABLE

THE OCCASION:
I am a 21-year-old university student in Cairo. I'm meeting friends for dinner at a stylish restaurant and then walking outdoors for 30 minutes.

WEATHER:
9°C, windy, after sunset. We will spend time both indoors and outdoors.

MY STYLE:
Pinterest-worthy Copenhagen winter street style, Scandinavian minimalism, elevated European fashion, rich color combinations, and interesting layering. I like chocolate brown, burgundy, charcoal, cream, and sophisticated texture contrasts.

I want outfits that look fashion-forward, expensive, and thoughtfully styled—not generic, excessively corporate, or like basic jeans and a sweater.

YOUR TASK:
Create THREE complete, genuinely different winter outfits.

MANDATORY REQUIREMENTS:
1. Use ONLY the 22 listed wardrobe items.
2. NEVER use W02, W04, W12, or W17. These garments are unavailable.
3. Every outfit must have appropriate upper-body clothing, a bottom, footwear, and sensible winter layering.
4. Consider the real temperature of 9°C, wind, and a 30-minute outdoor walk. A beautiful outfit that is too cold is not successful.
5. Make the three outfits visually distinct in color palette, layering, silhouette, and overall fashion direction.
6. Use interesting but harmonious color and texture combinations.
7. Explain how the layers work both outdoors and once I enter the warm restaurant.
8. Don't invent a coat, scarf, thermal layer, tights, socks, gloves, hat, or any other unlisted item.
9. Don't assume a garment has insulation, lining, a particular thickness, or weather resistance unless its description supports that conclusion.
10. Do not recommend purchases.
11. Consider realistic walking comfort and footwear suitability.
12. If the available wardrobe cannot create three genuinely weather-appropriate outfits, say so explicitly. Give only the valid outfits you can justify, and explain the limitations. Never sacrifice warmth or availability constraints merely to output three options.

FOR EACH OUTFIT, PROVIDE:
- A creative, fashionable outfit name.
- The exact wardrobe item IDs and garment names.
- Specific styling and layering instructions.
- An explanation of color harmony, fabric textures, silhouettes, and proportions.
- Why the look is fashionable rather than generic.
- Why it is or is not sufficiently warm for a windy 9°C evening.
- How it transitions from outdoor walking to indoor dinner.
- A fashion score out of 10 and a separate winter suitability score out of 10, each with a brief explanation.

FINALLY:
1. Choose your strongest outfit ONLY if it satisfies the winter requirements.
2. List its exact item IDs.
3. State whether the current wardrobe is adequately equipped for this winter scenario, without inventing missing clothing.

Be creative, precise, fashion-forward, and realistic. Do not claim a look is warm simply because it includes a jacket.
```

**Results:** Claude 94 · ChatGPT 93 · Gemini 79. ChatGPT stated no outfit could be verified as fully warm; Claude returned two outfits with practical layering but some warmth assumptions; Gemini was overconfident about suitability.

**Influence on the next test:** recognizing limits became a core requirement. Test 4 then removed eight items for an occasion the wardrobe could still serve, to test compliance without the weather problem.

### Test 4 — Restricted Wardrobe Challenge

**Objective:** fashionable outfits from only 14 available items, with strict availability compliance.

**Restrictions:** W01, W02, W04, W09, W11, W12, W16, W18 unavailable; no assuming unavailable items can be washed, returned or unpacked.

**Evaluation criteria:** zero unavailable items, suitability for both a presentation and dinner without changing, distinct outfits, a compliance declaration, honest count of valid outfits.

```text
You are the AI fashion stylist for Closet, an AI-powered digital wardrobe application. Your task is to create Pinterest-worthy, sophisticated outfits using ONLY the wardrobe items that are actually available.

This is a controlled fashion and constraint-following evaluation. Do not invent clothing or ignore availability statuses simply to create beautiful outfits.

MY WARDROBE:
W01 Burgundy oversized leather jacket — BORROWED (UNAVAILABLE)
W02 Chocolate brown suede jacket — BORROWED (UNAVAILABLE)
W03 Charcoal oversized tailored blazer — AVAILABLE
W04 Cream fitted long-sleeve top — LAUNDRY (UNAVAILABLE)
W05 White oversized poplin shirt — AVAILABLE
W06 Chocolate brown fitted knit top — AVAILABLE
W07 Burgundy fine-knit cardigan — AVAILABLE
W08 Grey off-shoulder knit sweater — AVAILABLE
W09 Dark-wash wide-leg jeans — LAUNDRY (UNAVAILABLE)
W10 Light-wash straight-leg jeans — AVAILABLE
W11 Cream tailored wide-leg trousers — PACKED (UNAVAILABLE)
W12 Charcoal pleated trousers — LAUNDRY (UNAVAILABLE)
W13 Black satin midi skirt — AVAILABLE
W14 Dark chocolate maxi skirt — AVAILABLE
W15 Black leather loafers — AVAILABLE
W16 Burgundy Adidas Samba sneakers — PACKED (UNAVAILABLE)
W17 Brown pointed-toe ankle boots — AVAILABLE
W18 Black kitten heels — UNAVAILABLE
W19 Burgundy shoulder bag — AVAILABLE
W20 Chocolate brown structured handbag — AVAILABLE
W21 Gold hoop earrings — AVAILABLE
W22 Brown leather belt — AVAILABLE

OCCASION:
I'm a 21-year-old university student in Cairo. I have an important university presentation in the afternoon, followed by dinner with friends at a stylish restaurant.

WEATHER:
19°C, mild. The outfit must work for both daytime and evening.

STYLE:
Pinterest-worthy, elevated European street style, Scandinavian minimalism, creative but sophisticated color coordination, excellent proportions, and refined accessories.

I want outfits that look fashionable, polished, confident and thoughtfully styled, not boring or excessively corporate.

YOUR TASK:
Generate up to THREE complete, genuinely different outfits using only available items.

STRICT RULES:
1. Only select clothing items from the list using their exact wardrobe IDs.
2. NEVER use W01, W02, W04, W09, W11, W12, W16 or W18.
3. Every outfit must have an appropriate top, bottom, and shoes.
4. Each outfit must be suitable for a university presentation AND a stylish dinner afterward, without requiring a clothing change.
5. All outfits must be fashionable, sophisticated and realistic.
6. Make the outfits visually distinct in color palettes, silhouettes and styling.
7. Do not invent new clothing, accessories, colors, materials or garment properties.
8. Do not propose buying anything.
9. Do not assume unavailable clothes can be washed, borrowed back or unpacked.
10. Do not recommend unavailable shoes even as alternatives.
11. Only generate three outfits if three complete, genuinely distinct and occasion-appropriate outfits are possible. Otherwise return fewer and explain the limitation.
12. Explain exactly why each outfit is valid under the availability constraints.

FOR EACH OUTFIT PROVIDE:
- A creative outfit name.
- All selected wardrobe items and their IDs.
- Styling instructions.
- Explanation of colors, textures and proportions.
- Why the outfit is fashionable rather than generic.
- Why it suits both the presentation and dinner.
- A fashion score out of 10.
- A constraint-compliance declaration.

AT THE END:
1. Choose the single strongest valid outfit.
2. List its exact wardrobe IDs.
3. State how many valid outfits you were able to produce.
4. Explicitly confirm that you did not use any unavailable garments.
5. Identify any limitations in the restricted wardrobe.

Remember: a creative outfit that violates a hard constraint is worse than a less exciting outfit that genuinely works. Prioritize stylish, valid recommendations.
```

**Results:** Claude 95 · ChatGPT 93 · Gemini 92. All three avoided the eight unavailable items; Claude gave three distinct day-to-evening looks.

**Influence on the decision:** with Test 3, this confirmed constraint awareness as a deciding factor and closed the experimental phase.

## Appendix B — Results tables and calculations

| Model | Test 1 | Test 2 | Test 3 | Test 4 | Sum | Per-experiment average | Final overall score |
| --- | --: | --: | --: | --: | --: | --: | --: |
| Claude | 94 | 95 | 94 | 95 | 378 | 94.50 | 96% |
| ChatGPT | 94 | 95 | 93 | 93 | 375 | 93.75 | 95% |
| Gemini | 89 | 93 | 79 | 92 | 353 | 88.25 | 93% |

Per-experiment average = sum ÷ 4, each test weighted equally. The final overall scores were not calculated from these figures (Section 8).

## Appendix C — Representative outfit recommendations

| Model | Strongest example | Why it scored as it did |
| --- | --- | --- |
| Claude | Test 4: chocolate knit top (W06), dark chocolate maxi skirt (W14), burgundy cardigan (W07), brown ankle boots (W17) | Tonal and polished for a presentation, warm enough in colour and texture for dinner; every piece available. |
| ChatGPT | Test 2, "Bordeaux After Dark": burgundy leather jacket (W01), chocolate knit top (W06), black satin midi skirt (W13), black kitten heels (W18), burgundy accessories | Strong statement styling and texture contrast (leather, knit, satin) suited to an upscale dinner. |
| Gemini | Test 2: tonal chocolate brown, charcoal and burgundy combinations | Good colour coordination; scored lower overall because other looks were over-layered (Test 1) or over-confident about warmth (Test 3). |

## Appendix D — API integration architecture

&#91;embedded content: Proposed API integration architecture · 8 steps, 1 fallback path\]

Claude only proposes outfits. The backend filters the wardrobe before the request and validates every returned ID afterwards; an invalid or incomplete response is retried under a controlled policy, then replaced by Closet's rule engine. This flow is proposed; Section 11 lists which parts exist in the code today.

## Appendix E — Supporting evidence

The following evidence is to be attached by the team. Nothing below has been fabricated or reconstructed.

| Evidence | Status |
| --- | --- |
| E1. Screenshots of the original prompts as sent to each assistant (Tests 1–4) | To be attached |
| E2. Model-generated outfit responses (ChatGPT, Gemini, Claude; Tests 1–4) | To be attached |
| E3. Evaluation sheets with per-test scores and notes | To be attached |
| E4. Record of the final evaluation that produced the 96% / 95% / 93% scores | To be attached, if it exists |
| E5. API benchmark results from the prepared kit (`raw_results.json`, `grading_sheet.csv`) | Not yet available: the kit has not been run |
