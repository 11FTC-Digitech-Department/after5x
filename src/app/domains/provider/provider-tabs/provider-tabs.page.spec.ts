import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderTabsPage } from './provider-tabs.page';

describe('ProviderTabsPage', () => {
  let component: ProviderTabsPage;
  let fixture: ComponentFixture<ProviderTabsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderTabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
