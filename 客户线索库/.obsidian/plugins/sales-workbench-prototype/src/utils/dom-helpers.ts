// DOM helper utilities for creating cyberpunk-styled elements

import { StatCardConfig, ButtonConfig, TagConfig, StatusItem } from '../types/data';

/**
 * Create a cyber-styled header
 */
export function createCyberHeader(
  parent: HTMLElement,
  title: string,
  subtitle?: string,
  statusItems?: StatusItem[]
): HTMLElement {
  const header = parent.createDiv({ cls: 'cyber-header' });

  const titleRow = header.createDiv({ cls: 'cyber-title-row' });

  const titleEl = titleRow.createDiv({ cls: 'cyber-title cyber-title-animated', text: title });

  if (subtitle) {
    titleRow.createDiv({ cls: 'cyber-subtitle', text: subtitle });
  }

  if (statusItems && statusItems.length > 0) {
    const statusBar = header.createDiv({ cls: 'cyber-status-bar' });
    for (const item of statusItems) {
      const statusItem = statusBar.createDiv({ cls: 'cyber-status-item' });
      if (item.animate) {
        const dot = statusItem.createDiv({ cls: 'cyber-status-dot' });
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.background = 'var(--neon-green)';
        dot.style.borderRadius = '50%';
      }
      statusItem.createSpan({ text: item.icon });
      statusItem.createSpan({ text: item.text });
    }
  }

  return header;
}

/**
 * Create a cyber-styled stat card
 */
export function createStatCard(
  parent: HTMLElement,
  config: StatCardConfig
): HTMLElement {
  const card = parent.createDiv({ cls: 'cyber-stat-card' });
  card.style.setProperty('--card-color', `var(--${config.colorVar})`);

  card.createDiv({ cls: 'cyber-stat-icon', text: config.icon });

  const valueEl = card.createDiv({ cls: 'cyber-stat-value', text: String(config.value) });
  valueEl.style.color = `var(--${config.colorVar})`;

  card.createDiv({ cls: 'cyber-stat-label', text: config.label });

  if (config.progress !== undefined) {
    const bar = card.createDiv({ cls: 'cyber-stat-bar' });
    const fill = bar.createDiv({ cls: 'cyber-stat-bar-fill progress-bar-fill' });
    fill.style.width = `${config.progress}%`;
    fill.style.background = `var(--${config.colorVar})`;
  }

  return card;
}

/**
 * Create a cyber-styled button
 */
export function createButton(
  parent: HTMLElement,
  config: ButtonConfig
): HTMLElement {
  const btn = parent.createEl('button', {
    cls: `cyber-btn cyber-btn-${config.type}`,
    text: config.text
  });

  if (config.icon) {
    btn.createSpan({ cls: 'cyber-btn-icon', text: config.icon });
  }

  if (config.onClick) {
    btn.addEventListener('click', config.onClick);
  }

  if (config.disabled) {
    btn.disabled = true;
  }

  return btn;
}

/**
 * Create a hexagonal checkbox
 */
export function createCheckbox(
  parent: HTMLElement,
  checked: boolean = false,
  onChange?: (checked: boolean) => void
): HTMLElement {
  const checkbox = parent.createDiv({ cls: 'cyber-checkbox' });
  if (checked) {
    checkbox.addClass('checked');
  }

  checkbox.addEventListener('click', () => {
    const newChecked = !checkbox.hasClass('checked');
    checkbox.toggleClass('checked', newChecked);
    if (onChange) {
      onChange(newChecked);
    }
  });

  return checkbox;
}

/**
 * Create a cyber-styled tag
 */
export function createTag(
  parent: HTMLElement,
  config: TagConfig
): HTMLElement {
  const tag = parent.createDiv({
    cls: 'cyber-tag',
    text: config.text
  });
  tag.dataset.type = config.colorVar;
  tag.style.setProperty('--tag-color', `var(--${config.colorVar})`);
  return tag;
}

/**
 * Create a cyber-styled card (work card)
 */
export function createCard(
  parent: HTMLElement,
  title: string,
  priorityHigh: boolean = false
): HTMLElement {
  const card = parent.createDiv({ cls: 'cyber-card' });
  if (priorityHigh) {
    card.addClass('priority-high');
  }

  card.createDiv({ cls: 'cyber-card-header', text: title });
  const body = card.createDiv({ cls: 'cyber-card-body' });

  return card;
}

/**
 * Create a field row (label + value)
 */
export function createFieldRow(
  parent: HTMLElement,
  label: string,
  value: string,
  editable: boolean = false
): HTMLElement {
  const row = parent.createDiv({ cls: 'field-row' });
  row.createDiv({ cls: 'field-label', text: label });

  if (editable) {
    const input = row.createEl('input', {
      cls: 'field-editable',
      attr: { value: value }
    });
    input.style.width = '100%';
    return row;
  }

  row.createDiv({ cls: 'field-value', text: value });
  return row;
}

/**
 * Create a linkable field (clicks navigate to source)
 */
export function createLinkableField(
  parent: HTMLElement,
  label: string,
  value: string,
  highlightId: string
): HTMLElement {
  const row = parent.createDiv({ cls: 'field-row' });
  row.createDiv({ cls: 'field-label', text: label });

  const linkable = row.createDiv({ cls: 'field-value field-linkable', text: value });
  linkable.dataset.highlightId = highlightId;

  return row;
}

/**
 * Create a queue item
 */
export function createQueueItem(
  parent: HTMLElement,
  title: string,
  statusText: string,
  onClick?: () => void
): HTMLElement {
  const item = parent.createDiv({ cls: 'queue-item' });

  item.createDiv({ cls: 'queue-item-title', text: title });
  item.createDiv({ cls: 'queue-item-status', text: statusText });

  if (onClick) {
    item.addEventListener('click', onClick);
    item.style.cursor = 'pointer';
  }

  return item;
}

/**
 * Create a mini stat
 */
export function createMiniStat(
  parent: HTMLElement,
  value: number | string,
  label: string,
  colorVar: string = 'neon-cyan'
): HTMLElement {
  const stat = parent.createDiv({ cls: 'stat-mini' });

  const valueEl = stat.createDiv({ cls: 'stat-mini-value', text: String(value) });
  valueEl.style.color = `var(--${colorVar})`;

  stat.createDiv({ cls: 'stat-mini-label', text: label });

  return stat;
}

/**
 * Format duration seconds to readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`;
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    return '刚刚';
  }
  if (hours < 24) {
    return `${hours}小时前`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}天前`;
  }
  return date.toLocaleDateString('zh-CN');
}