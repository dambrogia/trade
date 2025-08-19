import {Schema, model, Document} from 'mongoose';

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit'
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

export enum OrderStatus {
  PENDING = 'pending',
  FILLED = 'filled',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected'
}

export interface IOrder extends Document {
  symbol: string;
  assetClass: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  strike: number;
  takeProfit: number;
  stopLoss: number;
  strategy?: string;
  metadata?: Record<string, any>
  enteredAt?: Date;
  exitedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  symbol: {type: String, required: true, index: true},
  assetClass: {type: String},
  side: {type: String, enum: Object.values(OrderSide), required: true},
  type: {type: String, enum: Object.values(OrderType), required: true},
  status: {type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING},
  quantity: {type: Number, required: true, min: 0},
  strike: {type: Number, min: 0, required: true},
  stopLoss: {type: Number, min: 0, required: true},
  takeProfit: {type: Number, min: 0, required: true},
  strategy: {type: String, index: true},
  metadata: {type: Schema.Types.Mixed, index: false},
  enteredAt: Date,
  exitedAt: Date,
}, {
  timestamps: true,
});

// Indexes for performance
OrderSchema.index({symbol: 1, status: 1});
OrderSchema.index({createdAt: -1});
OrderSchema.index({strategy: 1, createdAt: -1});

export const Order = model<IOrder>('Order', OrderSchema);
