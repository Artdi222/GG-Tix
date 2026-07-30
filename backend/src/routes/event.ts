import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as eventService from "../services/event.service";
import { authMiddleware, adminOnly } from "../lib/middleware";

const eventRoute = new Hono();

const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid event ID format"),
});

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title max 200 characters"),
  artistId: z.string().uuid("Invalid artist ID format"),
  publisherName: z.string().min(1, "Publisher name is required").max(100),
  venue: z.string().min(1, "Venue is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid ISO date string"),
  status: z.enum(["open", "closed"]).optional(),
});

const updateEventSchema = createEventSchema.partial();

const updateStatusSchema = z.object({
  status: z.enum(["open", "closed"]),
});

const querySchema = z.object({
  search: z.string().optional(),
  artistId: z.string().uuid().optional(),
  city: z.string().optional(),
  status: z.enum(["open", "closed"]).optional(),
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10)),
});

// GET /api/events - Public list events
eventRoute.get("/", zValidator("query", querySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await eventService.listEvents(query);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/events/:id - Public event details
eventRoute.get("/:id", zValidator("param", uuidParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const event = await eventService.getEventById(id);
  return c.json({
    data: event,
  });
});

// POST /api/events - Admin create event
eventRoute.post(
  "/",
  authMiddleware,
  adminOnly,
  zValidator("json", createEventSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const newEvent = await eventService.createEvent({
      ...body,
      createdBy: user.sub,
    });
    return c.json(
      {
        message: "Event created successfully",
        data: newEvent,
      },
      201
    );
  }
);

// PUT /api/events/:id - Admin update event
eventRoute.put(
  "/:id",
  authMiddleware,
  adminOnly,
  zValidator("param", uuidParamSchema),
  zValidator("json", updateEventSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await eventService.updateEvent(id, body);
    return c.json({
      message: "Event updated successfully",
      data: updated,
    });
  }
);

// PATCH /api/events/:id/status - Admin update status / close sales
eventRoute.patch(
  "/:id/status",
  authMiddleware,
  adminOnly,
  zValidator("param", uuidParamSchema),
  zValidator("json", updateStatusSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const updated = await eventService.setEventStatus(id, status);
    return c.json({
      message: `Event status updated to ${status}`,
      data: updated,
    });
  }
);

// DELETE /api/events/:id - Admin delete event
eventRoute.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  zValidator("param", uuidParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await eventService.deleteEvent(id);
    return c.json({
      message: "Event deleted successfully",
    });
  }
);

export default eventRoute;
