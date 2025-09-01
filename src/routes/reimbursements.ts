import { Hono } from "hono";

import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

import type { AuthType } from "../lib/auth.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

app.get("/", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Find all orders where the current user is a participant
    const userOrders = await prisma.orderParticipants.findMany({
      where: {
        userId: userId,
      },
      include: {
        Order: {
          include: {
            OrderItem: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            Payment: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            orderParticipants: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            Restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Filter for group orders only (orders with more than one participant)
    const groupOrders = userOrders.filter(
      (orderParticipant) => orderParticipant.Order.orderParticipants.length > 1,
    );

    // Calculate reimbursements
    const reimbursements = {
      owedToMe: [], // Who owes money to the current user
      owedByMe: [], // Who the current user owes money to
      summary: {
        totalOwedToMe: 0,
        totalOwedByMe: 0,
        netBalance: 0, // Positive means others owe you, negative means you owe others
      },
    };

    // Process each group order
    for (const orderParticipant of groupOrders) {
      const order = orderParticipant.Order;

      // Skip orders without payments or with failed payments
      const validPayments = order.Payment.filter(
        (payment) =>
          payment.status === "paid" || payment.status === "completed",
      );

      if (validPayments.length === 0) continue;

      // Calculate what each user ordered (their share of the bill)
      const userShares = {};
      let totalOrderAmount = 0;

      order.OrderItem.forEach((item) => {
        const itemUserId = item.userId;
        const itemPrice = parseFloat(item.priceAtOrder);
        totalOrderAmount += itemPrice;

        if (!userShares[itemUserId]) {
          userShares[itemUserId] = {
            amount: 0,
            user: item.User,
          };
        }
        userShares[itemUserId].amount += itemPrice;
      });

      // Find who paid for this order
      const payers = {};
      validPayments.forEach((payment) => {
        const payerId = payment.userId;
        const paymentAmount = parseFloat(payment.amount);

        if (!payers[payerId]) {
          payers[payerId] = {
            amount: 0,
            user: payment.User,
          };
        }
        payers[payerId].amount += paymentAmount;
      });

      // Calculate reimbursements for this order
      Object.keys(userShares).forEach((consumerId) => {
        const consumerShare = userShares[consumerId].amount;
        const consumer = userShares[consumerId].user;

        Object.keys(payers).forEach((payerId) => {
          const payerTotalPaid = payers[payerId].amount;
          const payer = payers[payerId].user;

          // Calculate how much this consumer owes this payer
          // Formula: (consumer's share / total order amount) * amount paid by payer
          const owedAmount =
            (consumerShare / totalOrderAmount) * payerTotalPaid;

          // Skip if the consumer is the payer (can't owe themselves)
          if (consumerId === payerId) return;

          // Round to 2 decimal places
          const roundedAmount = Math.round(owedAmount * 100) / 100;

          if (roundedAmount > 0.01) {
            // Only include amounts greater than 1 cent
            if (consumerId === userId) {
              // Current user owes money to someone else
              const existingDebt = reimbursements.owedByMe.find(
                (debt) => debt.user.id === payerId,
              );

              if (existingDebt) {
                existingDebt.amount += roundedAmount;
                existingDebt.orders.push({
                  orderId: order.id,
                  restaurant: order.Restaurant.name,
                  orderDate: order.orderDate,
                  amount: roundedAmount,
                });
              } else {
                reimbursements.owedByMe.push({
                  user: payer,
                  amount: roundedAmount,
                  orders: [
                    {
                      orderId: order.id,
                      restaurant: order.Restaurant.name,
                      orderDate: order.orderDate,
                      amount: roundedAmount,
                    },
                  ],
                });
              }
            } else if (payerId === userId) {
              // Someone else owes money to current user
              const existingCredit = reimbursements.owedToMe.find(
                (credit) => credit.user.id === consumerId,
              );

              if (existingCredit) {
                existingCredit.amount += roundedAmount;
                existingCredit.orders.push({
                  orderId: order.id,
                  restaurant: order.Restaurant.name,
                  orderDate: order.orderDate,
                  amount: roundedAmount,
                });
              } else {
                reimbursements.owedToMe.push({
                  user: consumer,
                  amount: roundedAmount,
                  orders: [
                    {
                      orderId: order.id,
                      restaurant: order.Restaurant.name,
                      orderDate: order.orderDate,
                      amount: roundedAmount,
                    },
                  ],
                });
              }
            }
          }
        });
      });
    }

    // Calculate summary totals
    reimbursements.summary.totalOwedToMe = reimbursements.owedToMe.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    reimbursements.summary.totalOwedByMe = reimbursements.owedByMe.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    reimbursements.summary.netBalance =
      reimbursements.summary.totalOwedToMe -
      reimbursements.summary.totalOwedByMe;

    // Round summary amounts
    reimbursements.summary.totalOwedToMe =
      Math.round(reimbursements.summary.totalOwedToMe * 100) / 100;
    reimbursements.summary.totalOwedByMe =
      Math.round(reimbursements.summary.totalOwedByMe * 100) / 100;
    reimbursements.summary.netBalance =
      Math.round(reimbursements.summary.netBalance * 100) / 100;

    // Round individual amounts
    reimbursements.owedToMe.forEach((item) => {
      item.amount = Math.round(item.amount * 100) / 100;
    });

    reimbursements.owedByMe.forEach((item) => {
      item.amount = Math.round(item.amount * 100) / 100;
    });

    return c.json({
      success: true,
      data: reimbursements,
      totalGroupOrders: groupOrders.length,
    });
  } catch (err) {
    console.error("Error calculating reimbursements:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.post("/mark-paid", async (c) => {
  try {
    const body = await c.req.json();
    const { reimbursementId, userId, amount, paidAt } = body;

    // Basic validation
    if (!reimbursementId || !userId || !amount || !paidAt) {
      return c.json(
        {
          success: false,
          error: "Missing required fields",
        },
        400,
      );
    }

    // Parse reimbursementId to integer
    const parsedReimbursementId = parseInt(reimbursementId);

    if (isNaN(parsedReimbursementId)) {
      return c.json(
        {
          success: false,
          error: "Invalid reimbursement ID",
        },
        400,
      );
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // First, verify the reimbursement exists and belongs to the current user
      const reimbursement = await tx.reimbursement.findUnique({
        where: {
          id: parsedReimbursementId,
        },
        include: {
          debtor: true,
          creditor: true,
          order: {
            include: {
              restaurant: true,
              OrderItem: true,
            },
          },
        },
      });

      if (!reimbursement) {
        throw new Error("Reimbursement not found");
      }

      // Verify the amount matches (security check)
      if (parseFloat(reimbursement.amount.toString()) !== amount) {
        throw new Error("Amount mismatch");
      }

      // Check if already paid
      if (reimbursement.status === "paid") {
        throw new Error("Reimbursement already marked as paid");
      }

      // Update the reimbursement status
      const updatedReimbursement = await tx.reimbursement.update({
        where: { id: parsedReimbursementId },
        data: {
          status: "paid",
          settledAt: new Date(paidAt),
          updatedAt: new Date(),
        },
      });

      // Create a payment record for audit trail
      const paymentRecord = await tx.payment.create({
        data: {
          orderId: reimbursement.orderId,
          userId: reimbursement.debtorId,
          amount: reimbursement.amount,
          status: "completed",
          paymentDate: new Date(paidAt),
          transactionReference: `reimb_${parsedReimbursementId}_${Date.now()}`,
        },
      });

      return {
        reimbursement: updatedReimbursement,
        payment: paymentRecord,
      };
    });

    return c.json(
      {
        success: true,
        message: "Reimbursement marked as paid successfully",
        data: {
          reimbursementId: result.reimbursement.id,
          status: result.reimbursement.status,
          settledAt: result.reimbursement.settledAt,
          paymentId: result.payment.id,
        },
      },
      200,
    );
  } catch (error) {
    console.error("Error marking reimbursement as paid:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === "Reimbursement not found") {
        return c.json(
          {
            success: false,
            error: "Reimbursement not found",
          },
          404,
        );
      }

      if (
        error.message === "Amount mismatch" ||
        error.message === "Reimbursement already marked as paid"
      ) {
        return c.json(
          {
            success: false,
            error: error.message,
          },
          400,
        );
      }
    }

    return c.json(
      {
        success: false,
        error: "Internal server error",
      },
      500,
    );
  }
});

export default app;
