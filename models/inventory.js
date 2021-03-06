import mongoose from "mongoose";

const inventorySchema = mongoose.Schema({
  parentLocation: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Location",
  },
  dateStart: { type: String, required: true },
  dateEnd: { type: String, required: true },
  department: { type: String, required: true },
  isFinal: { type: Boolean, required: true },
  inventory: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Product",
      },
      quantity: { type: Number, required: false, default: 0 },
    },
  ],
  value: { type: Number, required: true },
});

export const Inventory = mongoose.model("Inventory", inventorySchema);
