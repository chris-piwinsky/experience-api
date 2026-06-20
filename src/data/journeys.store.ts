import type { CheckoutJourney } from "../types/checkout";

export interface JourneysStore {
  create(journey: CheckoutJourney): CheckoutJourney;
  getById(id: string): CheckoutJourney | undefined;
  update(journey: CheckoutJourney): CheckoutJourney;
  clear(): void;
}

export class InMemoryJourneysStore implements JourneysStore {
  private readonly journeys = new Map<string, CheckoutJourney>();

  create(journey: CheckoutJourney): CheckoutJourney {
    this.journeys.set(journey.id, journey);
    return journey;
  }

  getById(id: string): CheckoutJourney | undefined {
    return this.journeys.get(id);
  }

  update(journey: CheckoutJourney): CheckoutJourney {
    this.journeys.set(journey.id, journey);
    return journey;
  }

  clear(): void {
    this.journeys.clear();
  }
}
