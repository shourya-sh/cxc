import asyncio
from services.predictions import PredictionService
from services.polymarket import PolymarketService

async def test():
    poly = PolymarketService()
    pred = PredictionService()
    games = await poly.get_nba_games()
    print(f"Got {len(games)} games")
    results = pred.predict_games(games)
    has_pred = sum(1 for r in results if r is not None)
    print(f"Predictions: {has_pred}/{len(results)}")
    if has_pred > 0:
        first = next(r for r in results if r)
        print(f"Winner: {first['predicted_winner']} conf={first['confidence']}")
    else:
        # Show first few game titles to debug
        for g in games[:3]:
            title = g.get("title", "?")
            t = g.get("teams", [])
            names = [x["name"] for x in t] if t else []
            print(f"  {title} => {names}")

asyncio.run(test())
