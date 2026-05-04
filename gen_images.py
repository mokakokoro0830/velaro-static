import openai, os, base64, pathlib

client = openai.OpenAI(
    api_key=os.environ["OPENAI_API_KEY"]
)

JOBS = [
    (
        "hero",
        "1536x1024",
        "medium",
        "luxury private island resort aerial view, Maldives-style overwater villas extending into crystal turquoise lagoon, white sand beach, lush tropical greenery, golden afternoon sunlight, calm glassy water, cinematic wide shot, minimal and editorial luxury aesthetic, no text, no people",
    ),
    (
        "arrival",
        "1536x1024",
        "medium",
        "aerial drone photography of a small private tropical island in the Indian Ocean, surrounded by turquoise shallow lagoon fading to deep blue, white sand shore, dense palm trees, a few overwater bungalows visible, soft midday light, editorial luxury travel photography, no text",
    ),
    (
        "villa-overwater",
        "1024x1536",
        "medium",
        "luxury overwater villa bungalow in the Maldives, thatched roof, wooden deck extending over crystal clear turquoise water, infinity plunge pool, glass floor panel, teak furniture, bright natural light, minimalist interior visible through open sliding doors, no people, editorial photography",
    ),
    (
        "villa-beach",
        "1024x1536",
        "medium",
        "luxury beach villa in a tropical resort, direct white sand beach access, open-plan living area with floor-to-ceiling glass walls, outdoor rainfall shower surrounded by tropical plants, teak daybed on terrace, bright airy atmosphere, natural materials, no people, editorial luxury photography",
    ),
    (
        "villa-sunrise",
        "1024x1536",
        "medium",
        "luxury open-air tropical pavilion on elevated ground, panoramic horizon ocean view, large open-air bathtub on private terrace, golden sunrise light washing over teak and linen surfaces, calm water below, morning mist, serene and silent, no people, editorial luxury resort photography",
    ),
    (
        "exp-ocean",
        "1536x1024",
        "medium",
        "crystal clear shallow turquoise water over white sand and vibrant coral reef in the Maldives, school of colorful tropical fish visible below surface, sunlight refracting through water, calm and pristine, aerial or slightly above water angle, editorial nature photography, no people",
    ),
    (
        "exp-wellness",
        "1536x1024",
        "medium",
        "open-air luxury spa treatment pavilion in a tropical resort, bamboo and teak structure, white linen massage tables, surrounded by lush tropical foliage, soft diffused daylight filtering through leaves, stone water feature, serene minimal atmosphere, no people, editorial wellness photography",
    ),
    (
        "exp-dining",
        "1536x1024",
        "medium",
        "luxury private beach dinner setup at sunset, long wooden table on white sand, elegant white linen, flickering candles, tropical ocean backdrop with warm golden-pink sky, simple fresh floral arrangement, teak chairs, no people, editorial luxury travel photography",
    ),
    (
        "location-seaplane",
        "1536x1024",
        "medium",
        "small white seaplane approaching to land on turquoise Maldives lagoon, aerial perspective, crystal clear shallow water, small tropical island visible in background, bright midday sun, reflections on water surface, cinematic editorial travel photography, no text",
    ),
]

out = pathlib.Path("/Users/show/Documents/velaro-static/images")
out.mkdir(exist_ok=True)

for slug, size, quality, prompt in JOBS:
    dest = out / f"{slug}.jpg"
    if dest.exists():
        print(f"skip {slug}")
        continue
    print(f"generating {slug} ({size}, {quality})...")
    res = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size=size,
        quality=quality,
        n=1,
    )
    img_data = base64.b64decode(res.data[0].b64_json)
    dest.write_bytes(img_data)
    print(f"  saved {dest.name}")

print("done")
