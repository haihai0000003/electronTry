import { registry } from "@langchain/langgraph/zod";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import * as z from "zod";

const State = z.object({
  foo: z.string(),
  bar: z.array(z.string()).register(registry, {
    reducer: {
      fn: (x, y) => x.concat(y),
    },
    default: () => [] as string[],
  }),
});