import {esClient} from '#src/service/es-client';
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
  active: boolean;
  quantity: number;
  strike: number;
  exit?: number;
  takeProfit: number;
  pnl?: number;
  pnlPercentage?: number;
  stopLoss: number;
  strategy?: string;
  data?: Record<string, any>
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
  active: {type: Boolean, default: true},
  quantity: {type: Number, required: true, min: 0},
  strike: {type: Number, min: 0, required: true},
  exit: {type: Number, min: 0, required: false, default: null},
  stopLoss: {type: Number, min: 0, required: true},
  takeProfit: {type: Number, min: 0, required: true},
  pnl: {type: Number, required: false, default: null},
  pnlPercentage: {type: Number, required: false, default: null},
  strategy: {type: String, index: true},
  data: {type: Schema.Types.Mixed, index: false},
  enteredAt: Date,
  exitedAt: Date,
}, {
  timestamps: true,
});

// Indexes for performance
OrderSchema.index({symbol: 1, status: 1});
OrderSchema.index({createdAt: -1});
OrderSchema.index({strategy: 1, createdAt: -1});
OrderSchema.index({strategy: 1, createdAt: -1, active: 1});

// Post-save hook to replicate to Elasticsearch
OrderSchema.post('save', async function(doc) {
  try {
    // Convert mongoose document to plain object
    const orderData = doc.toObject();
    delete orderData._id;

    // Index document in Elasticsearch using same collection name
    await esClient.index({
      index: 'orders', // Same as collection name
      id: (doc as any)._id.toString(),
      body: orderData,
    });
  } catch (error) {
      // Don't throw error to avoid breaking the save operation
    console.error(`Failed to replicate order ${doc._id} to Elasticsearch:`, error);
  }
});

export const Order = model<IOrder>('Order', OrderSchema);

