export class OrderCreatedEvent {
  constructor(
    public readonly orderId: number,
    public readonly userId: number,
    public readonly pickupLat: number,
    public readonly pickupLng: number,
    public readonly dropoffLat: number,
    public readonly dropoffLng: number,
  ) {}
}
