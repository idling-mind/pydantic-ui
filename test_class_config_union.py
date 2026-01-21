"""Test script for class_configs in unions."""
import sys
sys.path.insert(0, '.')

from examples.basic.simple import MyModel, ui_config
from pydantic_ui.schema import parse_model

schema = parse_model(MyModel, class_configs=ui_config.class_configs)

# Check single_user (direct nested model)
print('=== single_user ===')
print('ui_config:', schema['fields']['single_user'].get('ui_config'))

# Check optional_complex (union with Person)
print()
print('=== optional_complex ===')
oc = schema['fields']['optional_complex']
print('type:', oc.get('type'))
if 'variants' in oc:
    for v in oc['variants']:
        print(f"  variant {v['variant_name']}: ui_config={v.get('ui_config')}")
        if v['variant_name'] == 'Person':
            print(f"    fields: {list(v.get('fields', {}).keys())}")
