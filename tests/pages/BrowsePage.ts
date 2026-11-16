import type { Locator, Page } from '@playwright/test';

export class BrowsePage {
  readonly page: Page;
  readonly heroHeading: Locator;
  readonly filters: Locator;
  readonly sortBy: Locator;
  readonly firstPlantCard: Locator;
  readonly firstPlantName: Locator;
  readonly resultsTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeading = page.getByRole('heading', { level: 1, name: /every windowsill/ });
    this.filters = page.getByRole('complementary', { name: 'Filters' });
    this.sortBy = this.filters.getByRole('combobox');
    this.firstPlantCard = page.getByRole('article').first();
    this.firstPlantName = this.firstPlantCard.getByRole('heading', { level: 3 });
    this.resultsTitle = page.getByRole('heading', { level: 2 });
  }

  /**
   * Plant card in the results grid, matched by its level-3 name heading.
   * @param name Accessible name of the plant card title.
   */
  plantCard(name: string | RegExp): Locator {
    return this.page.getByRole('article').filter({
      has: this.page.getByRole('heading', { level: 3, name }),
    });
  }

  /**
   * Opens the browse (home) route at `/` (optional catalog page for pagination).
   * @param webBase Shop origin without a trailing slash, or empty to use Playwright `baseURL`.
   * @param options Optional pagination (1-based).
   * @returns This page object.
   */
  async open(webBase = '', options?: { page?: number }): Promise<this> {
    const base = webBase.replace(/\/$/, '');
    const path = options?.page && options.page > 1 ? `/?page=${options.page}` : '/';
    const url = base ? `${base}${path}` : path;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    return this;
  }

  /**
   * Chooses a sort option in the filters sidebar.
   * @param label Visible option label in the Sort by control.
   * @returns Nothing.
   */
  async selectSortByLabel(label: string): Promise<void> {
    await this.sortBy.selectOption({ label });
  }
}
