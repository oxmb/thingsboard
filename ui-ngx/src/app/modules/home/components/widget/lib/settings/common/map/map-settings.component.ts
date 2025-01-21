///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { Component, DestroyRef, forwardRef, Input, OnInit } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validator
} from '@angular/forms';
import { ImageSourceType, MapDataLayerType, MapSetting, MapType } from '@home/components/widget/lib/maps/models/map.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge, Observable } from 'rxjs';
import { coerceBoolean } from '@shared/decorators/coercion';
import { IAliasController } from '@core/api/widget-api.models';
import { WidgetConfigCallbacks } from '@home/components/widget/config/widget-config.component.models';
import { DataKey, DataKeyConfigMode, Widget, widgetType } from '@shared/models/widget.models';
import { MapSettingsContext } from '@home/components/widget/lib/settings/common/map/map-settings.component.models';
import {
  DataKeyConfigDialogComponent,
  DataKeyConfigDialogData
} from '@home/components/widget/lib/settings/common/key/data-key-config-dialog.component';
import { deepClone } from '@core/utils';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'tb-map-settings',
  templateUrl: './map-settings.component.html',
  styleUrls: ['./../../widget-settings.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MapSettingsComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => MapSettingsComponent),
      multi: true
    }
  ]
})
export class MapSettingsComponent implements OnInit, ControlValueAccessor, Validator {

  MapType = MapType;

  @Input()
  disabled: boolean;

  @Input()
  @coerceBoolean()
  functionsOnly = false;

  @Input()
  aliasController: IAliasController;

  @Input()
  callbacks: WidgetConfigCallbacks;

  @Input()
  widget: Widget;

  context: MapSettingsContext;

  private modelValue: MapSetting;

  private propagateChange = null;

  public mapSettingsFormGroup: UntypedFormGroup;

  dataLayerMode: MapDataLayerType = 'markers';

  constructor(private fb: UntypedFormBuilder,
              private dialog: MatDialog,
              private destroyRef: DestroyRef) {
  }

  ngOnInit(): void {

    this.context = {
      functionsOnly: this.functionsOnly,
      aliasController: this.aliasController,
      callbacks: this.callbacks,
      widget: this.widget,
      editKey: this.editKey.bind(this),
      generateDataKey: this.generateDataKey.bind(this)
    };

    this.mapSettingsFormGroup = this.fb.group({
      mapType: [null, []],
      layers: [null, []],
      imageSourceType: [null, []],
      imageUrl: [null, []],
      imageEntityAlias: [null, []],
      imageUrlAttribute: [null, []],
      markers: [null, []],
      polygons: [null, []],
      circles: [null, []],
      additionalDataSources: [null, []],
      controlsPosition: [null, []],
      zoomActions: [null, []],
      fitMapBounds: [null, []],
      useDefaultCenterPosition: [null, []],
      defaultCenterPosition: [null, []],
      defaultZoomLevel: [null, []],
      mapPageSize: [null, []]
    });
    this.mapSettingsFormGroup.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateModel();
    });
    merge(this.mapSettingsFormGroup.get('mapType').valueChanges,
      this.mapSettingsFormGroup.get('imageSourceType').valueChanges
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateValidators();
    });
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(_fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.mapSettingsFormGroup.disable({emitEvent: false});
    } else {
      this.mapSettingsFormGroup.enable({emitEvent: false});
      this.updateValidators();
    }
  }

  writeValue(value: MapSetting): void {
    this.modelValue = value;
    this.mapSettingsFormGroup.patchValue(
      value, {emitEvent: false}
    );
    this.updateValidators();
  }

  public validate(c: UntypedFormControl) {
    const valid = this.mapSettingsFormGroup.valid;
    return valid ? null : {
      mapSettings: {
        valid: false,
      },
    };
  }

  private updateValidators() {
    const mapType: MapType = this.mapSettingsFormGroup.get('mapType').value;
    const imageSourceType: ImageSourceType = this.mapSettingsFormGroup.get('imageSourceType').value;
    if (mapType === MapType.geoMap) {
      this.mapSettingsFormGroup.get('layers').enable({emitEvent: false});
      this.mapSettingsFormGroup.get('imageSourceType').disable({emitEvent: false});
      this.mapSettingsFormGroup.get('imageUrl').disable({emitEvent: false});
      this.mapSettingsFormGroup.get('imageEntityAlias').disable({emitEvent: false});
      this.mapSettingsFormGroup.get('imageUrlAttribute').disable({emitEvent: false});
    } else {
      this.mapSettingsFormGroup.get('layers').disable({emitEvent: false});
      this.mapSettingsFormGroup.get('imageSourceType').enable({emitEvent: false});
      if (imageSourceType === ImageSourceType.image) {
        this.mapSettingsFormGroup.get('imageUrl').enable({emitEvent: false});
        this.mapSettingsFormGroup.get('imageEntityAlias').disable({emitEvent: false});
        this.mapSettingsFormGroup.get('imageUrlAttribute').disable({emitEvent: false});
      } else {
        this.mapSettingsFormGroup.get('imageUrl').disable({emitEvent: false});
        this.mapSettingsFormGroup.get('imageEntityAlias').enable({emitEvent: false});
        this.mapSettingsFormGroup.get('imageUrlAttribute').enable({emitEvent: false});
      }
    }
  }

  private updateModel() {
    this.modelValue = this.mapSettingsFormGroup.getRawValue();
    this.propagateChange(this.modelValue);
  }

  private editKey(key: DataKey, deviceId: string, entityAliasId: string): Observable<DataKey> {
    return this.dialog.open<DataKeyConfigDialogComponent, DataKeyConfigDialogData, DataKey>(DataKeyConfigDialogComponent,
      {
        disableClose: true,
        panelClass: ['tb-dialog', 'tb-fullscreen-dialog'],
        data: {
          dataKey: deepClone(key),
          dataKeyConfigMode: DataKeyConfigMode.general,
          aliasController: this.aliasController,
          widgetType: widgetType.latest,
          deviceId,
          entityAliasId,
          showPostProcessing: true,
          callbacks: this.callbacks,
          hideDataKeyColor: true,
          hideDataKeyDecimals: true,
          hideDataKeyUnits: true,
          widget: this.widget,
          dashboard: null,
          dataKeySettingsForm: null,
          dataKeySettingsDirective: null
        }
      }).afterClosed();
  }

  private generateDataKey(key: DataKey): DataKey {
    return this.callbacks.generateDataKey(key.name, key.type, null, false, null);
  }
}
