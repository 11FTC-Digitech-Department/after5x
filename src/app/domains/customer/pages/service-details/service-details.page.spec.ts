import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiceDetailsPage } from './service-details.page';

describe('ServiceDetailsPage', () => {
  let component: ServiceDetailsPage;
  let fixture: ComponentFixture<ServiceDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
