{% macro source_column_or_null(source_name, table_name, column_name, cast_type='TEXT') %}
    {% if execute %}
        {% set rel = source(source_name, table_name) %}
        {% set existing_rel = adapter.get_relation(database=rel.database, schema=rel.schema, identifier=rel.identifier) %}
        {% if existing_rel is not none %}
            {% set cols = adapter.get_columns_in_relation(rel) %}
            {% set colnames = cols | map(attribute='name') | map('lower') | list %}
            {% if column_name | lower in colnames %}
                {{ column_name }}::{{ cast_type }}
            {% else %}
                NULL::{{ cast_type }}
            {% endif %}
        {% else %}
            NULL::{{ cast_type }}
        {% endif %}
    {% else %}
        NULL::{{ cast_type }}
    {% endif %}
{% endmacro %}
