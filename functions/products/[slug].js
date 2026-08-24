import { renderContentPage } from "../lib/content-page.js";

export const onRequestGet = (context) => renderContentPage(context, "product");
