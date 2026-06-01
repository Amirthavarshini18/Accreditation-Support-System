import pandas as pd


def get_attainment_level(
    percentage
):

    if percentage >= 70:
        return 3

    elif percentage >= 60:
        return 2

    elif percentage >= 50:
        return 1

    else:
        return 0


def calculate_co_attainment(df):

    question_attainment = {}

    numeric_columns = df.select_dtypes(
        include='number'
    ).columns

    for column in numeric_columns:

        average_marks = round(
            df[column].mean(),
            2
        )

        max_marks = df[column].max()

        if max_marks == 0:
            attainment_percentage = 0

        else:

            attainment_percentage = round(

                (
                    average_marks /
                    max_marks
                ) * 100,

                2
            )

        attainment_level = (
            get_attainment_level(
                attainment_percentage
            )
        )

        question_attainment[
            column
        ] = {

            "average_marks":
                average_marks,

            "max_marks":
                float(max_marks),

            "attainment_percentage":
                attainment_percentage,

            "attainment_level":
                attainment_level
        }

    return {

        "question_attainment":
            question_attainment
    }


def calculate_co_from_mapping(

    question_results,
    mapping_df
):

    co_results = {}

    for _, row in mapping_df.iterrows():

        question = str(
            row["Question"]
        ).strip()

        co = str(
            row["CO"]
        ).strip()

        weight = float(
            row["Weight"]
        )

        if question not in question_results:
            continue

        attainment = question_results[
            question
        ][
            "attainment_percentage"
        ]

        weighted_attainment = (
            attainment * weight
        )

        if co not in co_results:

            co_results[co] = {

                "total": 0,

                "weight_sum": 0
            }

        co_results[co][
            "total"
        ] += weighted_attainment

        co_results[co][
            "weight_sum"
        ] += weight

    final_results = {}

    for co, values in co_results.items():

        final_attainment = round(

            values["total"] /
            values["weight_sum"],

            2
        )

        final_results[co] = {

            "attainment_percentage":
                final_attainment,

            "attainment_level":
                get_attainment_level(
                    final_attainment
                )
        }

    return final_results