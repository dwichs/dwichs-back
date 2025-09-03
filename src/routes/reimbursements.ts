import { Hono } from "hono";

import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

import type { AuthType } from "../lib/auth.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

// Define types for the reimbursement items
interface ReimbursementItem {
  user: any;
  amount: number;
  reimbursements: {
    id: number;
    orderId: number;
    restaurant: string;
    orderDate: Date;
    amount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

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
            Reimbursement: {
              include: {
                debtor: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                creditor: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
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

    // Calculate and create/update reimbursements
    const reimbursements = {
      owedToMe: [] as ReimbursementItem[],
      owedByMe: [] as ReimbursementItem[],
      summary: {
        totalOwedToMe: 0,
        totalOwedByMe: 0,
        netBalance: 0,
        totalPaidToMe: 0,
        totalPaidByMe: 0,
      },
    };

    // Helper function to check if a reimbursement status indicates it's settled
    const isReimbursementSettled = (status: string) => {
      return ["paid", "completed", "settled"].includes(status.toLowerCase());
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
      const userShares: Record<string, { amount: number; user: any }> = {};
      let totalOrderAmount = 0;

      order.OrderItem.forEach((item) => {
        const itemUserId = item.userId;
        if (!itemUserId) return; // Skip items without userId

        const itemPrice = Number(item.priceAtOrder);
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
      const payers: Record<string, { amount: number; user: any }> = {};
      validPayments.forEach((payment) => {
        const payerId = payment.userId;
        const paymentAmount = Number(payment.amount);

        if (!payers[payerId]) {
          payers[payerId] = {
            amount: 0,
            user: payment.User,
          };
        }
        payers[payerId].amount += paymentAmount;
      });

      // Calculate reimbursements for this order
      for (const consumerId of Object.keys(userShares)) {
        const consumerShare = userShares[consumerId]?.amount || 0;
        const consumer = userShares[consumerId]?.user;

        for (const payerId of Object.keys(payers)) {
          const payerTotalPaid = payers[payerId]?.amount || 0;
          const payer = payers[payerId]?.user;

          // Calculate how much this consumer owes this payer
          // Formula: (consumer's share / total order amount) * amount paid by payer
          const owedAmount =
            (consumerShare / totalOrderAmount) * payerTotalPaid;

          // Skip if the consumer is the payer (can't owe themselves)
          if (consumerId === payerId) continue;

          // Round to 2 decimal places
          const roundedAmount = Math.round(owedAmount * 100) / 100;

          if (roundedAmount > 0.01) {
            // Only include amounts greater than 1 cent

            // Check if reimbursement already exists
            let existingReimbursement = order.Reimbursement.find(
              (reimb) =>
                reimb.debtorId === consumerId && reimb.creditorId === payerId,
            );

            if (!existingReimbursement) {
              // Create new reimbursement record
              existingReimbursement = await prisma.reimbursement.create({
                data: {
                  amount: roundedAmount,
                  status: "unpaid",
                  description: `Reimbursement for order at ${order.Restaurant.name}`,
                  debtorId: consumerId,
                  creditorId: payerId,
                  orderId: order.id,
                },
                include: {
                  debtor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  creditor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              });
            } else if (
              Math.abs(Number(existingReimbursement.amount) - roundedAmount) >
                0.01 &&
              !isReimbursementSettled(existingReimbursement.status)
            ) {
              // Update existing reimbursement if amount changed significantly and it's not settled
              existingReimbursement = await prisma.reimbursement.update({
                where: { id: existingReimbursement.id },
                data: {
                  amount: roundedAmount,
                  updatedAt: new Date(),
                },
                include: {
                  debtor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  creditor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              });
            }

            // Check if this reimbursement is settled/paid
            const isSettled = isReimbursementSettled(
              existingReimbursement.status,
            );

            if (consumerId === userId) {
              // Current user owes money to someone else

              if (isSettled) {
                // Add to paid summary but don't include in owedByMe
                reimbursements.summary.totalPaidByMe += roundedAmount;
              } else {
                // Only include unsettled reimbursements in the owed list
                const existingDebt = reimbursements.owedByMe.find(
                  (debt) => debt.user.id === payerId,
                );

                if (existingDebt) {
                  existingDebt.amount += roundedAmount;
                  existingDebt.reimbursements.push({
                    id: existingReimbursement.id,
                    orderId: order.id,
                    restaurant: order.Restaurant.name,
                    orderDate: order.orderDate,
                    amount: roundedAmount,
                    status: existingReimbursement.status,
                    createdAt: existingReimbursement.createdAt,
                    updatedAt: existingReimbursement.updatedAt,
                  });
                } else {
                  reimbursements.owedByMe.push({
                    user: payer,
                    amount: roundedAmount,
                    reimbursements: [
                      {
                        id: existingReimbursement.id,
                        orderId: order.id,
                        restaurant: order.Restaurant.name,
                        orderDate: order.orderDate,
                        amount: roundedAmount,
                        status: existingReimbursement.status,
                        createdAt: existingReimbursement.createdAt,
                        updatedAt: existingReimbursement.updatedAt,
                      },
                    ],
                  });
                }
              }
            } else if (payerId === userId) {
              // Someone else owes money to current user

              if (isSettled) {
                // Add to paid summary but don't include in owedToMe
                reimbursements.summary.totalPaidToMe += roundedAmount;
              } else {
                // Only include unsettled reimbursements in the owed list
                const existingCredit = reimbursements.owedToMe.find(
                  (credit) => credit.user.id === consumerId,
                );

                if (existingCredit) {
                  existingCredit.amount += roundedAmount;
                  existingCredit.reimbursements.push({
                    id: existingReimbursement.id,
                    orderId: order.id,
                    restaurant: order.Restaurant.name,
                    orderDate: order.orderDate,
                    amount: roundedAmount,
                    status: existingReimbursement.status,
                    createdAt: existingReimbursement.createdAt,
                    updatedAt: existingReimbursement.updatedAt,
                  });
                } else {
                  reimbursements.owedToMe.push({
                    user: consumer,
                    amount: roundedAmount,
                    reimbursements: [
                      {
                        id: existingReimbursement.id,
                        orderId: order.id,
                        restaurant: order.Restaurant.name,
                        orderDate: order.orderDate,
                        amount: roundedAmount,
                        status: existingReimbursement.status,
                        createdAt: existingReimbursement.createdAt,
                        updatedAt: existingReimbursement.updatedAt,
                      },
                    ],
                  });
                }
              }
            }
          }
        }
      }
    }

    // Calculate summary totals (only for unsettled reimbursements)
    reimbursements.summary.totalOwedToMe = reimbursements.owedToMe.reduce(
      (sum: number, item: ReimbursementItem) => sum + item.amount,
      0,
    );

    reimbursements.summary.totalOwedByMe = reimbursements.owedByMe.reduce(
      (sum: number, item: ReimbursementItem) => sum + item.amount,
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
    reimbursements.summary.totalPaidToMe =
      Math.round(reimbursements.summary.totalPaidToMe * 100) / 100;
    reimbursements.summary.totalPaidByMe =
      Math.round(reimbursements.summary.totalPaidByMe * 100) / 100;

    // Round individual amounts
    reimbursements.owedToMe.forEach((item: ReimbursementItem) => {
      item.amount = Math.round(item.amount * 100) / 100;
    });

    reimbursements.owedByMe.forEach((item: ReimbursementItem) => {
      item.amount = Math.round(item.amount * 100) / 100;
    });

    return c.json({
      success: true,
      data: reimbursements,
      totalGroupOrders: groupOrders.length,
      stats: {
        totalReimbursements:
          reimbursements.owedToMe.length + reimbursements.owedByMe.length,
        totalPaidReimbursements:
          Math.round(
            (reimbursements.summary.totalPaidToMe +
              reimbursements.summary.totalPaidByMe) *
              100,
          ) / 100,
      },
    });
  } catch (err: unknown) {
    console.error("Error calculating reimbursements:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.patch("/:id/mark-paid", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const reimbursementId = parseInt(c.req.param("id"));
    if (isNaN(reimbursementId)) {
      return c.json({ error: "Invalid reimbursement ID" }, 400);
    }

    // Get the request body
    const body = await c.req.json();
    const {
      status = "paid",
      settledAt,
      paymentMethodId,
      transactionReference,
    } = body;

    // Validate status
    const validStatuses = ["paid", "completed", "settled"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return c.json(
        { error: "Invalid status. Must be one of: paid, completed, settled" },
        400,
      );
    }

    // First, find the reimbursement and verify permissions
    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
      include: {
        debtor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creditor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            Restaurant: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!reimbursement) {
      return c.json({ error: "Reimbursement not found" }, 404);
    }

    // Check if the current user is either the debtor or creditor
    const isDebtor = reimbursement.debtorId === userId;
    const isCreditor = reimbursement.creditorId === userId;

    if (!isDebtor && !isCreditor) {
      return c.json(
        {
          error:
            "Forbidden. You can only mark reimbursements as paid if you are involved in the transaction",
        },
        403,
      );
    }

    // Check if already paid
    if (
      ["paid", "completed", "settled"].includes(
        reimbursement.status.toLowerCase(),
      )
    ) {
      return c.json(
        {
          error: "Reimbursement is already marked as paid",
          data: {
            id: reimbursement.id,
            status: reimbursement.status,
            settledAt: reimbursement.settledAt,
          },
        },
        409,
      );
    }

    // Validate payment method if provided
    if (paymentMethodId) {
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          userId: userId, // Ensure the payment method belongs to the current user
        },
      });

      if (!paymentMethod) {
        return c.json(
          {
            error:
              "Invalid payment method or payment method does not belong to you",
          },
          400,
        );
      }
    }

    // Update the reimbursement
    const updatedReimbursement = await prisma.reimbursement.update({
      where: { id: reimbursementId },
      data: {
        status: status.toLowerCase(),
        settledAt: settledAt ? new Date(settledAt) : new Date(),
        updatedAt: new Date(),
        ...(paymentMethodId && { paymentMethodId }),
        ...(transactionReference && { transactionReference }),
      },
      include: {
        debtor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creditor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderDate: true,
            Restaurant: {
              select: {
                name: true,
              },
            },
          },
        },
        paymentMethod: {
          select: {
            id: true,
            type: true,
            accountNumber: true,
          },
        },
      },
    });

    return c.json({
      success: true,
      message: `Reimbursement successfully marked as ${status}`,
      data: {
        id: updatedReimbursement.id,
        amount: updatedReimbursement.amount,
        status: updatedReimbursement.status,
        settledAt: updatedReimbursement.settledAt,
        updatedAt: updatedReimbursement.updatedAt,
        debtor: updatedReimbursement.debtor,
        creditor: updatedReimbursement.creditor,
        order: {
          id: updatedReimbursement.order.id,
          orderDate: updatedReimbursement.order.orderDate,
          restaurant: updatedReimbursement.order.Restaurant.name,
        },
        paymentMethod: updatedReimbursement.paymentMethod,
        transactionReference: updatedReimbursement.transactionReference,
        markedBy: {
          userId,
          role: isDebtor ? "debtor" : "creditor",
        },
      },
    });
  } catch (err: unknown) {
    console.error("Error marking reimbursement as paid:", err);

    // Handle specific Prisma errors
    if (err && typeof err === "object" && "code" in err) {
      if (err.code === "P2025") {
        return c.json({ error: "Reimbursement not found" }, 404);
      }

      if (err.code === "P2002") {
        return c.json({ error: "Database constraint violation" }, 400);
      }
    }

    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// Optional: Endpoint to get reimbursement details
app.get("/reimbursements/:id", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const reimbursementId = parseInt(c.req.param("id"));
    if (isNaN(reimbursementId)) {
      return c.json({ error: "Invalid reimbursement ID" }, 400);
    }

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
      include: {
        debtor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creditor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderDate: true,
            Restaurant: {
              select: {
                name: true,
              },
            },
          },
        },
        paymentMethod: {
          select: {
            id: true,
            type: true,
            accountNumber: true,
          },
        },
      },
    });

    if (!reimbursement) {
      return c.json({ error: "Reimbursement not found" }, 404);
    }

    // Check if the current user is either the debtor or creditor
    const isDebtor = reimbursement.debtorId === userId;
    const isCreditor = reimbursement.creditorId === userId;

    if (!isDebtor && !isCreditor) {
      return c.json({ error: "Forbidden" }, 403);
    }

    return c.json({
      success: true,
      data: reimbursement,
    });
  } catch (err: unknown) {
    console.error("Error fetching reimbursement:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
